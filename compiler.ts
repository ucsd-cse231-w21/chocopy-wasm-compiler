import { Stmt, Expr, UniOp, BinOp, Type, Program, Literal, FunDef, ClosureDef, VarInit, Class } from "./ast";
import { NUM, BOOL, NONE, unhandledTag, unreachable } from "./utils";
import * as BaseException from "./error";
import { all } from "cypress/types/bluebird";

// https://learnxinyminutes.com/docs/wasm/

// Numbers are offsets into global memory
export type GlobalEnv = {
  globals: Map<string, number>;
  classes: Map<string, Map<string, [number, Literal]>>;
  locals: Set<string>;
  offset: number;
  funs: Map<string, [number, Array<string>]>; // <function name, [tbl idx, Array of nonlocals]>
};

export const emptyEnv: GlobalEnv = {
  globals: new Map(),
  classes: new Map(),
  locals: new Set(),
  offset: 0,
  funs: new Map(),
};

export function augmentEnv(env: GlobalEnv, prog: Program<Type>): GlobalEnv {
  const newGlobals = new Map(env.globals);
  const newClasses = new Map(env.classes);
  const newFuns = new Map(env.funs);

  // set the referenced value to be num since we use i32 in wasm
  const RefMap = new Map<string, [number, Literal]>();
  RefMap.set("$deref", [0, {tag: "num", value: BigInt(0)}]);
  newClasses.set("$ref", RefMap);

  let idx = newFuns.size;
  prog.closures.forEach((clo) => {
    newFuns.set(clo.name, [idx, clo.nonlocals]);
    idx += 1;
  });

  var newOffset = env.offset;
  prog.inits.forEach((v) => {
    newGlobals.set(v.name, newOffset);
    newOffset += 1;
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
    offset: newOffset,
    funs: newFuns
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

function getFuns(stmts: Array<Stmt<Type>>): Array<string> {
  let funs: Array<string> = [];
  stmts.forEach((stmt) => {
    if (stmt.tag == "expr" && stmt.expr.tag == "call_expr") {
      funs.push((stmt.expr.name as any).name);
    }
  });

  return funs;
}

export function compile(ast: Program<Type>, env: GlobalEnv): CompileResult {
  console.log(ast);
  const withDefines = augmentEnv(env, ast);

  const definedVars: Set<string> = new Set(); //getLocals(ast);
  definedVars.add("$last");
  definedVars.add("addr");
  ast.closures.forEach((clo) => {
    definedVars.add(clo.name);
  })
  const calledFuns = getFuns(ast.stmts);
  calledFuns.forEach((fun) => {
    definedVars.add(fun);
  });

  definedVars.forEach(env.locals.add, env.locals);
  
  const localDefines = makeLocals(definedVars);
  const funs: Array<string> = [];
  ast.funs.forEach((f) => {
    funs.push(codeGenFunDef(f, withDefines).join("\n"));
  });
  ast.closures.forEach((clo) => {
    funs.push(codeGenClosureDef(clo, withDefines).join("\n"));
  });
  
  const funNames: Array<string> = [];
  ast.closures.forEach((clo) => {
    funNames.push(clo.name);
  });
  calledFuns.forEach((fun) => {
    funNames.push(fun);
  });
  const initFuns = initNested(funNames, withDefines);

  const classes: Array<string> = ast.classes.map((cls) => codeGenClass(cls, withDefines)).flat();
  const allFuns = funs.concat(classes).join("\n\n");
  // const stmts = ast.filter((stmt) => stmt.tag !== "fun");
  const inits = ast.inits.map((init) => codeGenInit(init, withDefines)).flat();
  const commandGroups = ast.stmts.map((stmt) => codeGenStmt(stmt, withDefines));
  const commands = localDefines.concat(initFuns.concat(inits.concat(...commandGroups)));
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
      var valStmts = codeGenExpr(stmt.value, env);
      valStmts.push("return");
      return valStmts;
    case "assignment":
      throw new Error("Destructured assignment not implemented");
    case "assign":
      var valStmts = codeGenExpr(stmt.value, env);
      if (env.locals.has(stmt.name)) {
        return valStmts.concat([`(local.set $${stmt.name})`]);
      } else {
        const locationToStore = [`(i32.const ${envLookup(env, stmt.name)}) ;; ${stmt.name}`];
        return locationToStore.concat(valStmts).concat([`(i32.store)`]);
      }
    case "expr":
      var exprStmts = codeGenExpr(stmt.expr, env);
      return exprStmts.concat([`(local.set $$last)`]);
    case "if":
      var condExpr = codeGenExpr(stmt.cond, env);
      var thnStmts = stmt.thn.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      var elsStmts = stmt.els.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      return [
        `${condExpr.join("\n")} \n (if (then ${thnStmts.join("\n")}) (else ${elsStmts.join(
          "\n"
        )}))`,
      ];
    case "while":
      var wcondExpr = codeGenExpr(stmt.cond, env);
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
      return [...objStmts, `(i32.add (i32.const ${offset * 4}))`, ...valStmts, `(i32.store)`];
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

function myMemAlloc(name: string, size: number): Array<string> {
  const allocs: Array<string> = [];
  allocs.push(`(i32.load (i32.const 0))`);
  allocs.push(`(local.set ${name}) ;; allocate memory for ${name}`);
  allocs.push(`(i32.const 0)`);
  allocs.push(`(i32.add (local.get ${name}) (i32.const ${size * 4}))`);
  allocs.push(`(i32.store) ;; update the heap ptr`);
  return allocs;
}

function initNested(nested: Array<string>, env: GlobalEnv): Array<string> {
  const inits: Array<string> = [];
  nested.forEach((fun) => {
    let fun_info = env.funs.get(fun);
    inits.push(myMemAlloc(`$${fun}`, fun_info[1].length+1).join("\n"));
    inits.push(`(local.get $${fun})`);
    inits.push(`(i32.const ${fun_info[0]}) ;; function idx`);
    inits.push(`(i32.store)`);
  });

  return inits;
}

const funPtr = "$funPtr"; // the first extra argument

function initNonlocals(nonlocals: Array<string>): Array<string> {
  const inits: Array<string> = [];
  nonlocals.forEach((v, i) => {
    inits.push(`(i32.load (i32.add (local.get ${funPtr} (i32.const ${(i+1)*4}))))`);
    inits.push(`(local.set $${v})`);
  });

  return inits;
}

function codeGenClosureDef (def: ClosureDef<Type>, env: GlobalEnv): Array<string> {
  const definedVars: Set<string> = new Set();
  definedVars.add("addr");
  def.nonlocals.forEach((v) => definedVars.add(v));
  def.nested.forEach((v) => definedVars.add(v));
  def.inits.forEach((v) => definedVars.add(v.name));

  definedVars.forEach(env.locals.add, env.locals);
  def.parameters.forEach((p) => env.locals.add(p.name));

  const localDefs = makeLocals(definedVars).join("\n");
  const nonlocals = initNonlocals(def.nonlocals).join("\n");
  const nested = initNested(def.nested, env).join("\n");

  const inits = def.inits.map((init) => codeGenInit(init, env)).flat().join("\n");
  let params = def.parameters.map((p) => `(param $${p.name} i32)`).join(" ");
  let stmts = def.body.map((stmt) => codeGenStmt(stmt, env)).flat().join("\n");
  env.locals.clear();

  return [
    `(func $${def.name} (param ${funPtr} i32) ${params} (result i32)
    ${localDefs}
    ${nonlocals}
    ${nested}
    ${inits}
    ${stmts}
    )`
  ];
}

function codeGenFunDef(def: FunDef<Type>, env: GlobalEnv): Array<string> {
  var definedVars: Set<string> = new Set();
  def.inits.forEach((v) => definedVars.add(v.name));
  definedVars.add("$last");
  // def.parameters.forEach(p => definedVars.delete(p.name));
  definedVars.forEach(env.locals.add, env.locals);
  def.parameters.forEach((p) => env.locals.add(p.name));

  const localDefines = makeLocals(definedVars);
  const locals = localDefines.join("\n");
  const inits = def.inits
    .map((init) => codeGenInit(init, env))
    .flat()
    .join("\n");
  var params = def.parameters.map((p) => `(param $${p.name} i32)`).join(" ");
  var stmts = def.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
  var stmtsBody = stmts.join("\n");
  env.locals.clear();
  return [
    `(func $${def.name} ${params} (result i32)
    ${locals}
    ${inits}
    ${stmtsBody}
    (i32.const 0)
    (return))`,
  ];
}

function codeGenClass(cls: Class<Type>, env: GlobalEnv): Array<string> {
  const methods = [...cls.methods];
  methods.forEach((method) => (method.name = `${cls.name}$${method.name}`));
  const result = methods.map((method) => codeGenFunDef(method, env));
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
      valStmts.push(`(call $${expr.name})`);
      return valStmts;
    case "call_expr":
      const callExpr: Array<string> = [];
      const funName = (expr.name as any).name;
      const nonlocals = env.funs.get(funName)[1];
      nonlocals.forEach((name, i) => {
        callExpr.push(myMemAlloc("$addr", 1).join("\n"));
        callExpr.push(`(i32.store (local.get $addr) (local.get $${name}))`);
        callExpr.push(`(i32.store (i32.add (local.get $${funName}) (i32.const ${(i+1)*4})) (local.get $addr))`);
      });
      callExpr.push(`(local.get $${funName}) ;; argument for $funPtr`);
      expr.arguments.forEach((arg) => {
        callExpr.push(codeGenExpr(arg, env).join("\n"));
      });
      callExpr.push(`(call_indirect (type $callType${expr.arguments.length+1}) (i32.load (local.get $${funName})))`);
      return callExpr;
    case "construct":
      var stmts: Array<string> = [];
      env.classes.get(expr.name).forEach(([offset, initVal], field) =>
        stmts.push(
          ...[
            `(i32.load (i32.const 0))`, // Load the dynamic heap head offset
            `(i32.add (i32.const ${offset * 4}))`, // Calc field offset from heap offset
            ...codeGenLiteral(initVal, env), // Initialize field
            "(i32.store)", // Put the default field value on the heap
          ]
        )
      );
      return stmts.concat([
        "(i32.load (i32.const 0))", // Get address for the object (this is the return value)
        "(i32.load (i32.const 0))", // Get address for the object (this is the return value)
        "(i32.const 0)", // Address for our upcoming store instruction
        "(i32.load (i32.const 0))", // Load the dynamic heap head offset
        `(i32.add (i32.const ${env.classes.get(expr.name).size * 4}))`, // Move heap head beyond the two words we just created for fields
        "(i32.store)", // Save the new heap offset
        `(call $${expr.name}$__init__)`, // call __init__
        "(drop)",
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
      return [...objStmts, ...argsStmts, `(call $${className}$${expr.method})`];
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
      console.log("className", className);
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
