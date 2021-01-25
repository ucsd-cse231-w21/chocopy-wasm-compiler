import { Stmt, Expr, Op, Type, Program, Literal, FunDef, VarInit } from "./ast";
import { augmentTEnv, emptyGlobalTypeEnv, emptyLocalTypeEnv, GlobalTypeEnv, LocalTypeEnv, tc, tcBlock, tcDef, tcExpr } from "./type-check";
import { parse } from "./parser";
import { defaultTypeEnv } from "./runner";

// https://learnxinyminutes.com/docs/wasm/

// Numbers are offsets into global memory
export type GlobalEnv = {
  globals: Map<string, number>;
  locals: Set<string>;
  offset: number;
}

export const emptyEnv : GlobalEnv = { 
  globals: new Map(), 
  locals: new Set(),
  offset: 0 
};

export function augmentEnv(env: GlobalEnv, prog: Program) : GlobalEnv {
  const newGlobals = new Map(env.globals);

  var newOffset = env.offset;
  prog.inits.forEach((v) => {
    newGlobals.set(v.name, newOffset);
    newOffset += 1;
  })
  return {
    globals: newGlobals,
    locals: env.locals,
    offset: newOffset
  }
}

type CompileResult = {
  functions: string,
  mainSource: string,
  newEnv: GlobalEnv
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

export function makeLocals(locals: Set<string>) : Array<string> {
  const localDefines : Array<string> = [];
  locals.forEach(v => {
    localDefines.push(`(local $${v} i32)`);
  });
  return localDefines;

}

export function compile(source: string, env: GlobalEnv, tenv : GlobalTypeEnv) : CompileResult {
  const ast = parse(source);
  const tlocals = emptyLocalTypeEnv();

  const withDefines = augmentEnv(env, ast);
  const newTEnv = augmentTEnv(tenv, ast);

  const definedVars : Set<string> = new Set(); //getLocals(ast);
  definedVars.add("$last");
  definedVars.forEach(env.locals.add, env.locals);
  const localDefines = makeLocals(definedVars);
  const funs : Array<string> = [];
  ast.funs.forEach(f => {
    funs.push(codeGenDef(f, withDefines, tenv).join("\n"));
  });
  const allFuns = funs.join("\n\n");
  // const stmts = ast.filter((stmt) => stmt.tag !== "fun");
  const inits = ast.inits.map(init => codeGenInit(init, withDefines)).flat();
  const commandGroups = ast.stmts.map((stmt) => codeGenStmt(stmt, withDefines, tenv, tlocals));
  const commands = localDefines.concat(inits.concat([].concat.apply([], commandGroups)));
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

function codeGenStmt(stmt: Stmt, env: GlobalEnv, tenv: GlobalTypeEnv, tlocals: LocalTypeEnv) : Array<string> {
  switch(stmt.tag) {
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
      var valStmts = codeGenExpr(stmt.value, env, tenv, tlocals);
      valStmts.push("return");
      return valStmts;
    case "assign":
      var valStmts = codeGenExpr(stmt.value, env, tenv, tlocals);
      if (env.locals.has(stmt.name)) {
        return valStmts.concat([`(local.set $${stmt.name})`]); 
      } else {
        const locationToStore = [`(i32.const ${envLookup(env, stmt.name)}) ;; ${stmt.name}`];
        return locationToStore.concat(valStmts).concat([`(i32.store)`]);
      }
    case "expr":
      var exprStmts = codeGenExpr(stmt.expr, env, tenv, tlocals);
      return exprStmts.concat([`(local.set $$last)`]);
    case "if":
      var condExpr = codeGenExpr(stmt.cond, env, tenv, tlocals);
      var thnStmts = stmt.thn.map((innerStmt) => codeGenStmt(innerStmt, env, tenv, tlocals)).flat();
      var elsStmts = stmt.els.map((innerStmt) => codeGenStmt(innerStmt, env, tenv, tlocals)).flat();
      return [`${condExpr.join("\n")} \n (if (then ${thnStmts.join("\n")}) (else ${elsStmts.join("\n")}))`]
  }
}

function codeGenInit(init : VarInit, env : GlobalEnv) : Array<string> {
  const value = codeGenLiteral(init.value);
  if (env.locals.has(init.name)) {
    return [...value, `(local.set $${init.name})`]; 
  } else {
    const locationToStore = [`(i32.const ${envLookup(env, init.name)}) ;; ${init.name}`];
    return locationToStore.concat(value).concat([`(i32.store)`]);
  }
}

function codeGenDef(def : FunDef, env : GlobalEnv, tenv : GlobalTypeEnv) : Array<string> {
  const tlocals = tcDef(tenv, def);
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
  var stmts = def.body.map((innerStmt) => codeGenStmt(innerStmt, env, tenv, tlocals)).flat();
  var stmtsBody = stmts.join("\n");
  env.locals.clear();
  return [`(func $${def.name} ${params} (result i32)
    ${locals}
    ${inits}
    ${stmtsBody}
    (i32.const 0)
    (return))`];
}

function codeGenExpr(expr : Expr, env: GlobalEnv, tenv: GlobalTypeEnv, tlocals: LocalTypeEnv) : Array<string> {
  switch(expr.tag) {
    case "builtin1":
      var name = expr.name;
      const argTyp = tcExpr(tenv, tlocals, expr.arg);
      const argStmts = codeGenExpr(expr.arg, env, tenv, tlocals);
      var callName = expr.name;
      if (expr.name === "print" && argTyp === Type.NUM) {
        callName = "print_num";
      } else if (expr.name === "print" && argTyp === Type.BOOL) {
        callName = "print_bool";
      }
      return argStmts.concat([`(call $${callName})`]);
    case "builtin2":
      const leftStmts = codeGenExpr(expr.left, env, tenv, tlocals);
      const rightStmts = codeGenExpr(expr.right, env, tenv, tlocals);
      return [...leftStmts, ...rightStmts, `(call $${expr.name})`]
    case "literal":
      return codeGenLiteral(expr.value);
    case "id":
      if (env.locals.has(expr.name)) {
        return [`(local.get $${expr.name})`];
      } else {
        return [`(i32.const ${envLookup(env, expr.name)})`, `(i32.load)`]
      }
    case "op":
      const lhsStmts = codeGenExpr(expr.left, env, tenv, tlocals);
      const rhsStmts = codeGenExpr(expr.right, env, tenv, tlocals);
      return [...lhsStmts, ...rhsStmts, codeGenOp(expr.op)]
    case "call":
      var valStmts = expr.arguments.map((arg) => codeGenExpr(arg, env, tenv, tlocals)).flat();
      valStmts.push(`(call $${expr.name})`);
      return valStmts;
  }
}

function codeGenLiteral(literal : Literal) : Array<string> {
  switch(literal.tag) {
    case "num":
      return ["(i32.const " + literal.value + ")"];
    case "bool":
      return [`(i32.const ${Number(literal.value)})`];
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
    case Op.IDiv:
      return "(i32.div_s)"
    case Op.Mod:
      return "(i32.rem_s)"
    case Op.Eq:
      throw new Error("eq not implemented");
    case Op.Neq:
      throw new Error("neq not implemented");
    case Op.Lte:
      return "(i32.le_s)"
    case Op.Gte:
      return "(i32.ge_s)"
    case Op.Lt:
      return "(i32.lt_s)"
    case Op.Gt:
      return "(i32.gt_s)"
    case Op.Is:
      throw new Error("is not implemented")
    case Op.And:
      return "(i32.and)"
    case Op.Or:
      return "(i32.or)"
  }
}
