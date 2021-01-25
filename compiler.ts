import { Stmt, Expr, UniOp, BinOp, Type, Program, Literal, FunDef, VarInit } from "./ast";
import { augmentTEnv, emptyGlobalTypeEnv, emptyLocalTypeEnv, GlobalTypeEnv, LocalTypeEnv, tc, tcBlock, tcDef, tcExpr } from "./type-check";
import { parse } from "./parser";
import { defaultTypeEnv } from "./runner";
import { getCombinedNodeFlags } from "typescript";

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
      var thnStmts = stmt.thn.map(innerStmt => codeGenStmt(innerStmt, env, tenv, tlocals)).flat();
      var elsStmts = stmt.els.map(innerStmt => codeGenStmt(innerStmt, env, tenv, tlocals)).flat();
      return [`${condExpr.join("\n")} \n (if (then ${thnStmts.join("\n")}) (else ${elsStmts.join("\n")}))`]
    case "while":
      var wcondExpr = codeGenExpr(stmt.cond, env, tenv, tlocals);
      var bodyStmts = stmt.body.map(innerStmt => codeGenStmt(innerStmt, env, tenv, tlocals)).flat();
      return [`(block (loop  ${bodyStmts.join("\n")} (br_if 0 ${wcondExpr.join("\n")}) (br 1) ))`];
    case "pass":
      return [];
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
    case "binop":
      const lhsStmts = codeGenExpr(expr.left, env, tenv, tlocals);
      const rhsStmts = codeGenExpr(expr.right, env, tenv, tlocals);
      return [...lhsStmts, ...rhsStmts, codeGenBinOp(expr.op)]
    case "uniop":
      const exprStmts = codeGenExpr(expr.expr, env, tenv, tlocals);
      switch(expr.op){
        case UniOp.Neg:
          return [`(i32.const 0)`, ...exprStmts, `(i32.sub)`];
        case UniOp.Not:
          return [`(i32.const 0)`, ...exprStmts, `(i32.eq)`];
      }
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
      throw new Error("is not implemented")
    case BinOp.And:
      return "(i32.and)"
    case BinOp.Or:
      return "(i32.or)"
  }
}
