import { Stmt, Expr, Op } from "./ast";
import { parse } from "./parser";

// https://learnxinyminutes.com/docs/wasm/

// Numbers are offsets into global memory
export type GlobalEnv = {
  globals: Map<string, number>;
  locals: Set<string>;
  offset: number;
}

export const emptyEnv : GlobalEnv = { globals: new Map(), locals: new Set(), offset: 0 };

export function augmentEnv(env: GlobalEnv, stmts: Array<Stmt>) : GlobalEnv {
  const newEnv = new Map(env.globals);
  var newOffset = env.offset;
  stmts.forEach((s) => {
    switch(s.tag) {
      case "define":
        newEnv.set(s.name, newOffset);
        newOffset += 1;
        break;
    }
  })
  return {
    globals: newEnv,
    locals: env.locals,
    offset: newOffset
  }
}

type CompileResult = {
  functions: string,
  mainSource: string,
  newEnv: GlobalEnv
};

export function getLocals(ast : Array<Stmt>) : Set<string> {
  const definedVars : Set<string> = new Set();
  ast.forEach(s => {
    switch(s.tag) {
      case "define":
        definedVars.add(s.name);
        break;
    }
  }); 
  return definedVars;
}

export function makeLocals(locals: Set<string>) : Array<string> {
  const localDefines : Array<string> = [];
  locals.forEach(v => {
    localDefines.push(`(local $${v} i32)`);
  });
  return localDefines;

}

export function compile(source: string, env: GlobalEnv) : CompileResult {
  const ast = parse(source);
  const withDefines = augmentEnv(env, ast);

  const definedVars : Set<string> = new Set(); //getLocals(ast);
  definedVars.add("$last");
  definedVars.forEach(env.locals.add, env.locals);
  const localDefines = makeLocals(definedVars);
  const funs : Array<string> = [];
  ast.forEach((stmt, i) => {
    if(stmt.tag === "fun") { funs.push(codeGen(stmt, withDefines).join("\n")); }
  });
  const allFuns = funs.join("\n\n");
  const stmts = ast.filter((stmt) => stmt.tag !== "fun");
  
  const commandGroups = stmts.map((stmt) => codeGen(stmt, withDefines));
  const commands = localDefines.concat([].concat.apply([], commandGroups));
  withDefines.locals.clear();
  return {
    functions: allFuns,
    mainSource: commands.join("\n"),
    newEnv: withDefines
  };
}

function envLookup(env : GlobalEnv, name : string) : number {
  if(!env.globals.has(name)) { console.log("Could not find " + name + " in ", env); throw new Error("Could not find name " + name); }
  return (env.globals.get(name) * 4); // 4-byte values
}

function codeGen(stmt: Stmt, env: GlobalEnv) : Array<string> {
  switch(stmt.tag) {
    case "fun":
      const definedVars = getLocals(stmt.body);
      definedVars.add("$last");
      stmt.parameters.forEach(p => definedVars.delete(p.name));
      definedVars.forEach(env.locals.add, env.locals);
      stmt.parameters.forEach(p => env.locals.add(p.name));
      
      const localDefines = makeLocals(definedVars);
      const locals = localDefines.join("\n");
      var params = stmt.parameters.map(p => `(param $${p.name} i32)`).join(" ");
      var stmts = stmt.body.map((innerStmt) => codeGen(innerStmt, env)).flat();
      var stmtsBody = stmts.join("\n");
      return [`(func $${stmt.name} ${params} (result i32)
        ${locals}
        ${stmtsBody}
        (i32.const 0)
        (return))`];
    case "return":
      var valStmts = codeGenExpr(stmt.value, env);
      valStmts.push("return");
      return valStmts;
    case "define":
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
  }
}

function codeGenExpr(expr : Expr, env: GlobalEnv) : Array<string> {
  switch(expr.tag) {
    case "builtin1":
      const argStmts = codeGenExpr(expr.arg, env);
      return argStmts.concat([`(call $${expr.name})`]);
    case "builtin2":
      const leftStmts = codeGenExpr(expr.left, env);
      const rightStmts = codeGenExpr(expr.right, env);
      return [...leftStmts, ...rightStmts, `(call $${expr.name})`]
    case "num":
      return ["(i32.const " + expr.value + ")"];
    case "id":
      if (env.locals.has(expr.name)) {
        return [`(local.get $${expr.name})`];
      } else {
        return [`(i32.const ${envLookup(env, expr.name)})`, `(i32.load)`]
      }
    case "op":
      const lhsStmts = codeGenExpr(expr.left, env);
      const rhsStmts = codeGenExpr(expr.right, env);
      return [...lhsStmts, ...rhsStmts, codeGenOp(expr.op)]
    case "call":
      var valStmts = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
      valStmts.push(`(call $${expr.name})`);
      return valStmts;
  }
}

function codeGenOp(op : Op) : string {
  switch(op) {
    case Op.Plus:
      return "(i32.add)"
    case Op.Minus:
      return "(i32.sub)"
    case Op.Mul:
      return "(i32.mul)"
  }
}
