import { Stmt, Expr, UniOp, BinOp, Type, Program, Literal, FunDef, VarInit, Class } from "./ast";
import { NUM, BOOL, STRING, NONE, unhandledTag, unreachable } from "./utils";
import * as BaseException from "./error";

// https://learnxinyminutes.com/docs/wasm/

// Numbers are offsets into global memory
export type GlobalEnv = {
  globals: Map<string, number>;
  classes: Map<string, Map<string, [number, Literal]>>;
  locals: Set<string>;
  offset: number;
};

export const emptyEnv: GlobalEnv = {
  globals: new Map(),
  classes: new Map(),
  locals: new Set(),
  offset: 0,
};

export function augmentEnv(env: GlobalEnv, prog: Program<Type>): GlobalEnv {
  const newGlobals = new Map(env.globals);
  const newClasses = new Map(env.classes);

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

export function compile(ast: Program<Type>, env: GlobalEnv): CompileResult {
  const withDefines = augmentEnv(env, ast);

  const definedVars: Set<string> = new Set(); //getLocals(ast);
  definedVars.add("$last");
  definedVars.add("$string_val"); //needed for string operations
  definedVars.add("$string_class"); //needed for strings in class
  definedVars.add("$string_index"); //needed for string index check out of bounds
  definedVars.forEach(env.locals.add, env.locals);
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

function codeGenDef(def: FunDef<Type>, env: GlobalEnv): Array<string> {
  var definedVars: Set<string> = new Set();
  def.inits.forEach((v) => definedVars.add(v.name));
  definedVars.add("$last");
  definedVars.add("$string_val"); //needed for string operations
  definedVars.add("$string_class"); //needed for strings in class
  definedVars.add("$string_index"); //needed for string index check out of bounds
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
      } else if (expr.name === "print" && argTyp === STRING) {
        callName = "print_str";
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
    case "construct":
      var stmts: Array<string> = [];
      stmts.push(
        ...[
          "(i32.const 0)", // Address for our upcoming store instruction
          "(i32.load (i32.const 0))", // Load the dynamic heap head offset
          "(local.set $$string_class)",
          "(i32.load (i32.const 0))",
          `(i32.add (i32.const ${env.classes.get(expr.name).size * 4}))`, // Move heap head beyond the two words we just created for fields
          "(i32.store)", // Save the new heap offset
        ]
      );
      env.classes.get(expr.name).forEach(([offset, initVal], field) =>
        stmts.push(
          ...[
            `(local.get $$string_class)`,
            `(i32.add (i32.const ${offset * 4}))`, // Calc field offset from heap offset
            ...codeGenLiteral(initVal, env), // Initialize field
            "(i32.store)", // Put the default field value on the heap
          ]
        )
      );
      stmts.push(
        ...[
          "(local.get $$string_class)",
          `(call $${expr.name}$__init__)`, // call __init__
          "(drop)",
          "(local.get $$string_class)",
        ]
      );
      return stmts;
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
      var [offset, _] = env.classes.get(className).get(expr.field);
      return [...objStmts, `(i32.add (i32.const ${offset * 4}))`, `(i32.load)`];
    case "bracket-lookup":
      if (expr.a.tag == "string") {
        var brObjStmts = codeGenExpr(expr.obj, env);
        var brKeyStmts = codeGenExpr(expr.key, env);
        var brStmts = [];
        //First check whether index is out of bounds, if so, throw error by going to print_str. Then index the string.
        brStmts.push(
          ...[
            `${brObjStmts.join("\n")}`, //Load the string object to be indexed
            `(local.set $$string_index)`,
            `${brKeyStmts.join("\n")}`, //Add the index * 4 value to the address
            `(local.get $$string_index)(i32.load)(i32.gt_s)`,
            `(if (then (i32.const -1)(call $print_str)(drop)))`, //Check if string index is out of bounds
            `(local.get $$string_index)`,
            `(i32.add (i32.mul (i32.const 4)${brKeyStmts.join("\n")}))`, //Add the index * 4 value to the address
            `(i32.add (i32.const 4))`, //Adding 4 since string length is at first index
            `(i32.load)`, //Load the ASCII value of the string index
            `(local.set $$string_val)`, //store value in temp variable
            `(i32.load (i32.const 0))`, //load value at 0
            `(i32.const 0)`, //Length of string is 1, but store as 4 for easier checking
            `(i32.store)`, //Store length of string in the first position
            `(i32.load (i32.const 0))`, //Load latest free memory
            `(i32.add (i32.const 4))`, //Add 4 since we have stored string length at beginning
            `(local.get $$string_val)`, //load value in temp variable
            "(i32.store)", //Store the ASCII value in the new address
          ]
        );
        //At end of string, we store ASCII value 0 which represents null
        brStmts.push(
          ...[
            `(i32.load (i32.const 0))`, // Load the dynamic heap head offset
            `(i32.add (i32.const 8))`, // Calc string index offset from heap offset
            `(i32.const 0)`, // Store ASCII value for 0 (end of string)
            "(i32.store)", // Store the ASCII value 0 in the new address
          ]
        );
        brStmts.push(
          ...[
            "(i32.load (i32.const 0))", // Get address for the indexed character of the string
            "(i32.const 0)", // Address for our upcoming store instruction
            "(i32.load (i32.const 0))", // Load the dynamic heap head offset
            `(i32.add (i32.const 12))`, // Move heap head beyond the string length
            "(i32.store)", // Save the new heap offset
          ]
        );
        return brStmts;
      }
    default:
      unhandledTag(expr);
  }
}

function allocateStringMemory(string_val: string): Array<string> {
  const stmts = [];
  var i = 1;
  //Storing the length of the string at the beginning
  stmts.push(
    ...[
      `(i32.load (i32.const 0))`, // Load the dynamic heap head offset
      `(i32.const ${string_val.length - 1})`, // Store ASCII value for 0 (end of string)
      "(i32.store)", // Store the ASCII value 0 in the new address
    ]
  );
  while (i != string_val.length + 1) {
    const char_ascii = string_val.charCodeAt(i - 1);
    stmts.push(
      ...[
        `(i32.load (i32.const 0))`, // Load the dynamic heap head offset
        `(i32.add (i32.const ${i * 4}))`, // Calc string index offset from heap offset
        `(i32.const ${char_ascii})`, // Store the ASCII value of the string index
        "(i32.store)", // Store the ASCII value in the new address
      ]
    );
    i += 1;
  }
  //At end of string, we store ASCII value 0 which represents null
  stmts.push(
    ...[
      `(i32.load (i32.const 0))`, // Load the dynamic heap head offset
      `(i32.add (i32.const ${i * 4}))`, // Calc string index offset from heap offset
      `(i32.const 0)`, // Store ASCII value for 0 (end of string)
      "(i32.store)", // Store the ASCII value 0 in the new address
    ]
  );
  return stmts.concat([
    "(i32.load (i32.const 0))", // Get address for the first character of the string
    "(i32.const 0)", // Address for our upcoming store instruction
    "(i32.load (i32.const 0))", // Load the dynamic heap head offset
    `(i32.add (i32.const ${(string_val.length + 2) * 4}))`, // Move heap head beyond the string length
    "(i32.store)", // Save the new heap offset
  ]);
}

function codeGenLiteral(literal: Literal, env: GlobalEnv): Array<string> {
  switch (literal.tag) {
    case "num":
      return ["(i32.const " + literal.value + ")"];
    case "string":
      return allocateStringMemory(literal.value);
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
