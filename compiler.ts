import { Stmt, Expr, UniOp, BinOp, Type, Program, Literal, FunDef, VarInit, Class } from "./ast";
import { NUM, BOOL, NONE, unhandledTag, unreachable } from "./utils";
import * as BaseException from "./error";
import { MemoryManager, TAG_CLASS } from "./alloc";

// https://learnxinyminutes.com/docs/wasm/

// Numbers are offsets into global memory
export type GlobalEnv = {
  globals: Map<string, number>;
  classes: Map<string, Map<string, [number, Literal]>>;
  locals: Map<string, number>;      // Map from local/param to stack slot index
};

export const emptyEnv: GlobalEnv = {
  globals: new Map(),
  classes: new Map(),
  locals: new Map(),
};

const RELEASE_TEMPS = true;
const HOLD_TEMPS = false;

export function augmentEnv(env: GlobalEnv, prog: Program<Type>, mm: MemoryManager): GlobalEnv {
  const newGlobals = new Map(env.globals);
  const newClasses = new Map(env.classes);

  prog.inits.forEach((v) => {
    // Allocate static memory for the global variable
    // NOTE(alex:mm) assumes that allocations return a 32-bit address
    const globalAddr = mm.staticAlloc(4n);
    console.log(`global var '${v.name}' addr: ${globalAddr.toString()}`);
    newGlobals.set(v.name, Number(globalAddr));
    mm.addGlobal(globalAddr);
  });
  prog.classes.forEach((cls) => {
    const classFields = new Map();
    cls.fields.forEach((field, i) => classFields.set(field.name, [i, field.value]));
    newClasses.set(cls.name, classFields);
  });
  return {
    globals: newGlobals,
    classes: newClasses,
    locals: env.locals,
  };
}

type CompileResult = {
  functions: string;
  mainSource: string;
  newEnv: GlobalEnv;
};

// export function getLocals(ast : Array<Stmt>) : Set<string> {
//   const definedVars : Set<string> = new Set();
//   ast.forEach(s => {
//     switch(s.tag) {
//       case "define":
//         definedVars.add(s.name);
//         break;
//     }
//   });
//   return definedVars;
// }

export function makeLocals(locals: Set<string>): Array<string> {
  const localDefines: Array<string> = [];
  locals.forEach((v) => {
    localDefines.push(`(local $${v} i32)`);
  });
  return localDefines;
}

export function compile(ast: Program<Type>, env: GlobalEnv, mm: MemoryManager): CompileResult {
  const withDefines = augmentEnv(env, ast, mm);

  let stackIndexOffset = 0;   // NOTE(alex:mm): assumes start function has no params
  const definedVars: Set<string> = new Set(); //getLocals(ast);
  definedVars.add("$last");
  definedVars.add("$allocPointer"); // Used to cache the result of `gcalloc`
  definedVars.forEach(v => {
    env.locals.set(v, stackIndexOffset);
    stackIndexOffset += 1;
  });
  const localDefines = makeLocals(definedVars);
  const funs: Array<string> = [];
  ast.funs.forEach((f) => {
    funs.push(codeGenDef(f, withDefines).join("\n"));
  });
  const classes: Array<string> = ast.classes.map((cls) => codeGenClass(cls, withDefines)).flat();
  const allFuns = funs.concat(classes).join("\n\n");
  // const stmts = ast.filter((stmt) => stmt.tag !== "fun");
  const inits = ast.inits.map((init) => codeGenInit(init, withDefines)).flat();
  const commandGroups = ast.stmts.map((stmt) => codeGenStmt(stmt, withDefines));
  const commands = localDefines.concat(inits.concat(...commandGroups));
  withDefines.locals.clear();
  return {
    functions: allFuns,
    mainSource: commands.join("\n"),
    newEnv: withDefines,
  };
}

function envLookup(env: GlobalEnv, name: string): number {
  if (!env.globals.has(name)) {
    console.log("Could not find " + name + " in ", env);
    throw new Error("Could not find name " + name);
  }
  return env.globals.get(name) * 4; // 4-byte values
}

function codeGenStmt(stmt: Stmt<Type>, env: GlobalEnv): Array<string> {
  switch (stmt.tag) {
    // case "fun":
    //   const definedVars = getLocals(stmt.body);
    //   definedVars.add("$last");
    //   stmt.parameters.forEach(p => definedVars.delete(p.name));
    //   definedVars.forEach(env.locals.add, env.locals);
    //   stmt.parameters.forEach(p => env.locals.add(p.name));

    //   const localDefines = makeLocals(definedVars);
    //   const locals = localDefines.join("\n");
    //   var params = stmt.parameters.map(p => `(param $${p.name} i32)`).join(" ");
    //   var stmts = stmt.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
    //   var stmtsBody = stmts.join("\n");
    //   env.locals.clear();
    //   return [`(func $${stmt.name} ${params} (result i32)
    //     ${locals}
    //     ${stmtsBody}
    //     (i32.const 0)
    //     (return))`];
    case "return":
      var valStmts = codeGenTempGuard(codeGenExpr(stmt.value, env), RELEASE_TEMPS);

      // returnTemp places the return expr value into the caller's temp set
      // NOTE(alex:mm): We need to put temporaries and escaping pointers into
      //   the calling statement's temp frame, not a new one.
      //
      // By placing them into the calling statement's temp frame, escaping pointers
      //   have an opportunity to be rooted without fear of the GC cleaning it up
      // TODO(alex:mm): instead of relying on escape analysis, we'll just try to
      //   add the returned value to the parent temp frame
      valStmts.push("(call $returnTemp)");
      valStmts.push("(call $releaseLocals)");
      valStmts.push("return");

      return valStmts;
    case "assignment":
      throw new Error("Destructured assignment not implemented");
    case "assign":
      var valStmts = codeGenExpr(stmt.value, env);
      if (env.locals.has(stmt.name)) {
        // NOTE(alex:mm): removeLocal/addLocal calls are necessary b/c
        //   MemoryManager cannot scan the WASM stack directly and
        //   must maintain a list of local variable pointers
        // Local i32's are always initialized to 0
        //   * removeLocal/addLocal ignore 0x0 pointers
        // These functions do a runtime tag-check to distinguish pointers
        const localIndex = env.locals.get(stmt.name);
        if (localIndex === undefined) {
          throw new Error(`ICE: missing index for local ${stmt.name}`);
        }
        const result = valStmts.concat([`(local.set $${stmt.name})`])
          .concat([
            `(i32.const ${localIndex.toString()})`,
            `(local.get $${stmt.name})`,
            `(call $addLocal)`
          ]);

        return codeGenTempGuard(result, RELEASE_TEMPS);
      } else {
        // NOTE(alex:mm): all global variables in linear memory can be
        //   scanned by MemoryManager for pointers
        const locationToStore = [`(i32.const ${envLookup(env, stmt.name)}) ;; ${stmt.name}`];
        return codeGenTempGuard(
          locationToStore.concat(valStmts).concat([`(i32.store)`]),
          RELEASE_TEMPS
        );
      }
    case "expr":
      var exprStmts = codeGenExpr(stmt.expr, env);
      return codeGenTempGuard(exprStmts.concat([`(local.set $$last)`]), RELEASE_TEMPS);
    case "if":
      // TODO(alex:mm): Are these temporary guards correct/minimal?
      var condExpr = codeGenTempGuard(codeGenExpr(stmt.cond, env), RELEASE_TEMPS);
      var thnStmts = stmt.thn.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      var elsStmts = stmt.els.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      return [
        `${condExpr.join("\n")} \n (if (then ${thnStmts.join("\n")}) (else ${elsStmts.join(
          "\n"
        )}))`,
      ];
    case "while":
      // TODO(alex:mm): Are these temporary guards correct/minimal?
      var wcondExpr = codeGenTempGuard(codeGenExpr(stmt.cond, env), RELEASE_TEMPS);
      var bodyStmts = stmt.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      return [`(block (loop  ${bodyStmts.join("\n")} (br_if 0 ${wcondExpr.join("\n")}) (br 1) ))`];
    case "pass":
      return [];
    case "field-assign":
      var objStmts = codeGenExpr(stmt.obj, env);
      var objTyp = stmt.obj.a;
      if (objTyp.tag !== "class") {
        // I don't think this error can happen
        throw new Error(
          "Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag
        );
      }
      var className = objTyp.name;
      var [offset, _] = env.classes.get(className).get(stmt.field);
      var valStmts = codeGenExpr(stmt.value, env);
      const result = [
        ...objStmts,
        `(i32.add (i32.const ${offset * 4}))`,
        ...valStmts,
        `(i32.store)`,
      ];
      return codeGenTempGuard(result, RELEASE_TEMPS);
    default:
      unhandledTag(stmt);
  }
}

function codeGenInit(init: VarInit<Type>, env: GlobalEnv): Array<string> {
  const value = codeGenLiteral(init.value, env);
  if (env.locals.has(init.name)) {
    return [...value, `(local.set $${init.name})`];
  } else {
    const locationToStore = [`(i32.const ${envLookup(env, init.name)}) ;; ${init.name}`];
    return locationToStore.concat(value).concat([`(i32.store)`]);
  }
}

function codeGenDef(def: FunDef<Type>, env: GlobalEnv): Array<string> {

  var definedVars: Set<string> = new Set();
  def.inits.forEach((v) => definedVars.add(v.name));
  definedVars.add("$last");
  // Used to cache the result of `gcalloc` and dump
  //   it to the stack for initialization
  // NOTE(alex:mm): need to `local.get` object pointer BEFORE generating code
  //   for inner expressions
  definedVars.add("$allocPointer");

  // NOTE(alex:mm): parameters indices go first
  let currLocalIndex = 0;
  var params = def.parameters.map((p) => {
    env.locals.set(p.name, currLocalIndex);
    currLocalIndex += 1;
    return `(param $${p.name} i32)`;
  }).join(" ");

  // def.parameters.forEach(p => definedVars.delete(p.name));
  definedVars.forEach(v => {
    env.locals.set(v, currLocalIndex);
    currLocalIndex += 1;
  });

  const localDefines = makeLocals(definedVars);

  const locals = localDefines.join("\n");
  const inits = def.inits
    .map((init) => codeGenInit(init, env))
    .flat()
    .join("\n");
  var stmts = def.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
  var stmtsBody = stmts.join("\n");
  env.locals.clear();

  return [
    `(func $${def.name} ${params} (result i32)
    ${locals}
    (call $pushFrame)
    ${inits}
    ${stmtsBody}
    (call $releaseLocals)
    (i32.const 0)
    (return))`,
  ];
}

function codeGenClass(cls: Class<Type>, env: GlobalEnv): Array<string> {
  const methods = [...cls.methods];
  methods.forEach((method) => (method.name = `${cls.name}$${method.name}`));
  const result = methods.map((method) => codeGenDef(method, env));
  return result.flat();
}

function codeGenExpr(expr: Expr<Type>, env: GlobalEnv): Array<string> {
  switch (expr.tag) {
    case "builtin1":
      const argTyp = expr.a;
      const argStmts = codeGenExpr(expr.arg, env);
      var callName = expr.name;
      if (expr.name === "print" && argTyp === NUM) {
        callName = "print_num";
      } else if (expr.name === "print" && argTyp === BOOL) {
        callName = "print_bool";
      } else if (expr.name === "print" && argTyp === NONE) {
        callName = "print_none";
      }
      return argStmts.concat([`(call $${callName})`]);
    case "builtin2":
      const leftStmts = codeGenExpr(expr.left, env);
      const rightStmts = codeGenExpr(expr.right, env);
      return [...leftStmts, ...rightStmts, `(call $${expr.name})`];
    case "literal":
      return codeGenLiteral(expr.value, env);
    case "id":
      if (env.locals.has(expr.name)) {
        return [`(local.get $${expr.name})`];
      } else {
        return [`(i32.const ${envLookup(env, expr.name)})`, `(i32.load)`];
      }
    case "binop":
      const lhsStmts = codeGenExpr(expr.left, env);
      const rhsStmts = codeGenExpr(expr.right, env);
      return [...lhsStmts, ...rhsStmts, codeGenBinOp(expr.op)];
    case "uniop":
      const exprStmts = codeGenExpr(expr.expr, env);
      switch (expr.op) {
        case UniOp.Neg:
          return [`(i32.const 0)`, ...exprStmts, `(i32.sub)`];
        case UniOp.Not:
          return [`(i32.const 0)`, ...exprStmts, `(i32.eq)`];
        default:
          return unreachable(expr);
      }
    case "call":
      var valStmts = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
      valStmts.push(`(call $pushCaller)`);
      valStmts.push(`(call $${expr.name})`);
      valStmts.push(`(call $popCaller)`);
      return valStmts;
    case "construct":
      var stmts: Array<string> = [
        `(i32.const ${Number(TAG_CLASS)})   ;; heap-tag: class`,
        `(i32.const ${env.classes.get(expr.name).size * 4})   ;; size in bytes`,
        `(call $gcalloc)`,
        `(local.set $$allocPointer)`,
        `(local.get $$allocPointer)`,   // return to parent expr
        `(local.get $$allocPointer)`,   // use in __init__
      ];
      // NOTE(alex): hack to get nested allocations to work
      // Let F by the number of fields in the class
      // Dump the pointer F + 2 times on the stack
      //   * +1 in order to call the __init__ method
      //   * +1 in order to return the leave the pointer at the top of the stack
      const classLayout = env.classes.get(expr.name);
      classLayout.forEach(() => {
        stmts.push(`(local.get $$allocPointer)`);
      });
      classLayout.forEach(([offset, initVal], field) =>
        stmts.push(
          ...[
            // Pointer should be on the top of the stack already
            `(i32.add (i32.const ${offset * 4}))`, // Calc field offset from heap offset
            ...codeGenLiteral(initVal, env), // Initialize field
            "(i32.store)", // Put the default field value on the heap
          ]
        )
      );
      return stmts.concat([
        // Pointer to deref should be on the top of the stack already
        `(call $${expr.name}$__init__)`, // call __init__
        `(drop)`,   // Drop None from __init__
        // Pointer to return should be on the top of the stack already
      ]);
    case "method-call":
      var objStmts = codeGenExpr(expr.obj, env);
      var objTyp = expr.obj.a;
      if (objTyp.tag !== "class") {
        // I don't think this error can happen
        throw new Error(
          "Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag
        );
      }
      var className = objTyp.name;
      var argsStmts = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
      return [
        ...objStmts,
        ...argsStmts,
        `(call $pushCaller)`,
        `(call $${className}$${expr.method})`,
        `(call $popCaller)`,
      ];
    case "lookup":
      var objStmts = codeGenExpr(expr.obj, env);
      var objTyp = expr.obj.a;
      if (objTyp.tag !== "class") {
        // I don't think this error can happen
        throw new Error(
          "Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag
        );
      }
      var className = objTyp.name;
      var [offset, _] = env.classes.get(className).get(expr.field);
      return [...objStmts, `(i32.add (i32.const ${offset * 4}))`, `(i32.load)`];
    default:
      unhandledTag(expr);
  }
}

function codeGenLiteral(literal: Literal, env: GlobalEnv): Array<string> {
  switch (literal.tag) {
    case "num":
      return ["(i32.const " + literal.value + ")"];
    case "bool":
      return [`(i32.const ${Number(literal.value)})`];
    case "none":
      return [`(i32.const 0)`];
    default:
      unhandledTag(literal);
  }
}

function codeGenBinOp(op: BinOp): string {
  switch (op) {
    case BinOp.Plus:
      return "(i32.add)";
    case BinOp.Minus:
      return "(i32.sub)";
    case BinOp.Mul:
      return "(i32.mul)";
    case BinOp.IDiv:
      return "(i32.div_s)";
    case BinOp.Mod:
      return "(i32.rem_s)";
    case BinOp.Eq:
      return "(i32.eq)";
    case BinOp.Neq:
      return "(i32.ne)";
    case BinOp.Lte:
      return "(i32.le_s)";
    case BinOp.Gte:
      return "(i32.ge_s)";
    case BinOp.Lt:
      return "(i32.lt_s)";
    case BinOp.Gt:
      return "(i32.gt_s)";
    case BinOp.Is:
      return "(i32.eq)";
    case BinOp.And:
      return "(i32.and)";
    case BinOp.Or:
      return "(i32.or)";
  }
}

// Required so that heap-allocated temporaries are considered rooted/reachable
// Without the call to `captureTemps`, heap-allocated temporaries may be accidently
//   freed
// Necessary because cannot scan the WASM stack for pointers so the MemoryManager
//   must maintain its own list of reachable objects
function codeGenTempGuard(c: Array<string>, release: boolean): Array<string> {
  if (release) {
    return ["(call $captureTemps)"].concat(c).concat(["(call $releaseTemps)"]);
  }

  return ["(call $captureTemps)"].concat(c);
}
