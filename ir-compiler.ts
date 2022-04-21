import { Program, Stmt, Expr, Value, Class, VarInit, FunDef } from "./ir"
import { BinOp, Type, UniOp } from "./ast"
import { BOOL, NONE, NUM } from "./utils";

export type GlobalEnv = {
  globals: Map<string, number>;
  classes: Map<string, Map<string, [number, Value<Type>]>>;  
  locals: Set<string>;
  offset: number;
}

export const emptyEnv : GlobalEnv = { 
  globals: new Map(), 
  classes: new Map(),
  locals: new Set(),
  offset: 0 
};

type CompileResult = {
  functions: string,
  mainSource: string,
  newEnv: GlobalEnv
};

export function augmentEnv(env: GlobalEnv, prog: Program<Type>) : GlobalEnv {
  const newGlobals = new Map(env.globals);
  const newClasses = new Map(env.classes);

  var newOffset = env.offset;
  prog.inits.forEach((v) => {
    newGlobals.set(v.name, newOffset);
    newOffset += 1;
  });
  prog.classes.forEach(cls => {
    const classFields = new Map();
    cls.fields.forEach((field, i) => classFields.set(field.name, [i, field.value]));
    newClasses.set(cls.name, classFields);
  });
  return {
    globals: newGlobals,
    classes: newClasses,
    locals: env.locals,
    offset: newOffset
  }
}

export function makeLocals(locals: Set<string>) : Array<string> {
  const localDefines : Array<string> = [];
  locals.forEach(v => {
    localDefines.push(`(local $${v} i32)`);
  });
  return localDefines;
}

export function compile(ast: Program<Type>, env: GlobalEnv) : CompileResult {
  const withDefines = augmentEnv(env, ast);

  const definedVars : Set<string> = new Set(); //getLocals(ast);
  definedVars.add("$last");
  definedVars.forEach(env.locals.add, env.locals);
  const localDefines = makeLocals(definedVars);
  const funs : Array<string> = [];
  ast.funs.forEach(f => {
    funs.push(codeGenDef(f, withDefines).join("\n"));
  });
  const classes : Array<string> = ast.classes.map(cls => codeGenClass(cls, withDefines)).flat();
  const allFuns = funs.concat(classes).join("\n\n");
  // const stmts = ast.filter((stmt) => stmt.tag !== "fun");
  const inits = ast.inits.map(init => codeGenInit(init, withDefines)).flat();
  const commandGroups = ast.stmts.map((stmt) => codeGenStmt(stmt, withDefines));
  const commands = localDefines.concat(inits.concat([].concat.apply([], commandGroups)));
  withDefines.locals.clear();
  return {
    functions: allFuns,
    mainSource: commands.join("\n"),
    newEnv: withDefines
  };
}

function codeGenStmt(stmt: Stmt<Type>, env: GlobalEnv): Array<string> {
  switch (stmt.tag) {
    case "assign":
      var valStmts = codeGenExpr(stmt.value, env);
      if (env.locals.has(stmt.name)) {
        return valStmts.concat([`(local.set $${stmt.name})`]); 
      } else {
        const locationToStore = [`(i32.const ${envLookup(env, stmt.name)}) ;; ${stmt.name}`];
        return locationToStore.concat(valStmts).concat([`(i32.store)`]);
      }

    case "return":
      var valStmts = codeGenValue(stmt.value, env);
      valStmts.push("return");
      return valStmts;

    case "expr":
      var exprStmts = codeGenExpr(stmt.expr, env);
      return exprStmts.concat([`(local.set $$last)`]);

    case "pass":
      return []

    case "field-assign":
      var objStmts = codeGenValue(stmt.obj, env);
      var objTyp = stmt.obj.a;
      if(objTyp.tag !== "class") { // I don't think this error can happen
        throw new Error("Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag);
      }
      var className = objTyp.name;
      var [offset, _] = env.classes.get(className).get(stmt.field);
      var valStmts = codeGenValue(stmt.value, env);
      return [
        ...objStmts,
        `(i32.add (i32.const ${offset * 4}))`,
        ...valStmts,
        `(i32.store)`
      ];

    case "ifjmp":
      return []

    case "label":
      return []

    case "jmp":
      return []

  }
}

function codeGenExpr(expr: Expr<Type>, env: GlobalEnv): Array<string> {
  switch (expr.tag) {
    case "value":
      return codeGenValue(expr.value, env)

    case "binop":
      const lhsStmts = codeGenValue(expr.left, env);
      const rhsStmts = codeGenValue(expr.right, env);
      return [...lhsStmts, ...rhsStmts, codeGenBinOp(expr.op)]

    case "uniop":
      const exprStmts = codeGenValue(expr.expr, env);
      switch(expr.op){
        case UniOp.Neg:
          return [`(i32.const 0)`, ...exprStmts, `(i32.sub)`];
        case UniOp.Not:
          return [`(i32.const 0)`, ...exprStmts, `(i32.eq)`];
      }

    case "builtin1":
      const argTyp = expr.a;
      const argStmts = codeGenValue(expr.arg, env);
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
      const leftStmts = codeGenValue(expr.left, env);
      const rightStmts = codeGenValue(expr.right, env);
      return [...leftStmts, ...rightStmts, `(call $${expr.name})`]

    case "call":
      var valStmts = expr.arguments.map((arg) => codeGenValue(arg, env)).flat();
      valStmts.push(`(call $${expr.name})`);
      return valStmts;

    case "lookup":
      var objStmts = codeGenValue(expr.obj, env);
      var objTyp = expr.obj.a;
      if(objTyp.tag !== "class") { // I don't think this error can happen
        throw new Error("Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag);
      }
      var className = objTyp.name;
      var [offset, _] = env.classes.get(className).get(expr.field);
      return [
        ...objStmts,
        `(i32.add (i32.const ${offset * 4}))`,
        `(i32.load)`
      ];

    case "method-call":
      var objStmts = codeGenValue(expr.obj, env);
      var objTyp = expr.obj.a;
      if(objTyp.tag !== "class") { // I don't think this error can happen
        throw new Error("Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag);
      }
      var className = objTyp.name;
      var argsStmts = expr.arguments.map((arg) => codeGenValue(arg, env)).flat();
      return [
        ...objStmts,
        ...argsStmts,
        `(call $${className}$${expr.method})`
      ];

    case "construct":
      var stmts : Array<string> = [];
      env.classes.get(expr.name).forEach(([offset, initVal], field) => 
        stmts.push(...[
          `(i32.load (i32.const 0))`,              // Load the dynamic heap head offset
          `(i32.add (i32.const ${offset * 4}))`,   // Calc field offset from heap offset
          ...codeGenValue(initVal, env),              // Initialize field
          "(i32.store)"                            // Put the default field value on the heap
        ]));
      return stmts.concat([
        "(i32.load (i32.const 0))",                                       // Get address for the object (this is the return value)
        "(i32.load (i32.const 0))",                                       // Get address for the object (this is the return value)
        "(i32.const 0)",                                                  // Address for our upcoming store instruction
        "(i32.load (i32.const 0))",                                       // Load the dynamic heap head offset
        `(i32.add (i32.const ${env.classes.get(expr.name).size * 4}))`,   // Move heap head beyond the two words we just created for fields
        "(i32.store)",                                                    // Save the new heap offset
        `(call $${expr.name}$__init__)`,                                  // call __init__
        "(drop)"
      ]);
  }
}

function codeGenValue(val: Value<Type>, env: GlobalEnv): Array<string> {
  switch (val.tag) {
    case "num":
      return ["(i32.const " + val.value + ")"];
    case "bool":
      return [`(i32.const ${Number(val.value)})`];
    case "none":
      return [`(i32.const 0)`];
    case "id":
      if (env.locals.has(val.name)) {
        return [`(local.get $${val.name})`];
      } else {
        return [`(i32.const ${envLookup(env, val.name)})`, `(i32.load)`]
      }
  }
}

function codeGenBinOp(op : BinOp) : string {
  switch(op) {
    case BinOp.Plus:
      return "(i32.add)"
    case BinOp.Minus:
      return "(i32.sub)"
    case BinOp.Mul:
      return "(i32.mul)"
    case BinOp.IDiv:
      return "(i32.div_s)"
    case BinOp.Mod:
      return "(i32.rem_s)"
    case BinOp.Eq:
      return "(i32.eq)"
    case BinOp.Neq:
      return "(i32.ne)"
    case BinOp.Lte:
      return "(i32.le_s)"
    case BinOp.Gte:
      return "(i32.ge_s)"
    case BinOp.Lt:
      return "(i32.lt_s)"
    case BinOp.Gt:
      return "(i32.gt_s)"
    case BinOp.Is:
      return "(i32.eq)";
    case BinOp.And:
      return "(i32.and)"
    case BinOp.Or:
      return "(i32.or)"
  }
}

function codeGenInit(init : VarInit<Type>, env : GlobalEnv) : Array<string> {
  const value = codeGenValue(init.value, env);
  if (env.locals.has(init.name)) {
    return [...value, `(local.set $${init.name})`]; 
  } else {
    const locationToStore = [`(i32.const ${envLookup(env, init.name)}) ;; ${init.name}`];
    return locationToStore.concat(value).concat([`(i32.store)`]);
  }
}

function codeGenDef(def : FunDef<Type>, env : GlobalEnv) : Array<string> {
  var definedVars : Set<string> = new Set();
  def.inits.forEach(v => definedVars.add(v.name));
  definedVars.add("$last");
  // def.parameters.forEach(p => definedVars.delete(p.name));
  definedVars.forEach(env.locals.add, env.locals);
  def.parameters.forEach(p => env.locals.add(p.name));

  const localDefines = makeLocals(definedVars);
  const locals = localDefines.join("\n");
  const inits = def.inits.map(init => codeGenInit(init, env)).flat().join("\n");
  var params = def.parameters.map(p => `(param $${p.name} i32)`).join(" ");
  var stmts = def.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
  var stmtsBody = stmts.join("\n");
  env.locals.clear();
  return [`(func $${def.name} ${params} (result i32)
    ${locals}
    ${inits}
    ${stmtsBody}
    (i32.const 0)
    (return))`];
}

function codeGenClass(cls : Class<Type>, env : GlobalEnv) : Array<string> {
  const methods = [...cls.methods];
  methods.forEach(method => method.name = `${cls.name}$${method.name}`);
  const result = methods.map(method => codeGenDef(method, env));
  return result.flat();
}

function envLookup(env : GlobalEnv, name : string) : number {
  if(!env.globals.has(name)) { console.log("Could not find " + name + " in ", env); throw new Error("Could not find name " + name); }
  return (env.globals.get(name) * 4); // 4-byte values
}