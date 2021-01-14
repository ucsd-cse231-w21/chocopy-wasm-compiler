
import {Stmt, Expr, Type, NUM, BOOL, OBJ, NONE} from './ast';


export type GlobalTypeEnv = {
  globals: Map<string, Type>,
  functions: Map<string, [Array<Type>, Type]>
}

type LocalTypeEnv = Map<string, Type>;

export type TypeError = {
  message: string
}

export function isSubtype(env : GlobalTypeEnv, t1 : Type, t2 : Type) : boolean {
  return false;
}

export function isAssignable(env : GlobalTypeEnv, t1 : Type, t2 : Type) : boolean {
  return false;
}

export function join(env : GlobalTypeEnv, t1 : Type, t2 : Type) : Type {
  return { tag: "none" }

}

export function updateGlobalTypeEnv(env : GlobalTypeEnv, program : Array<Stmt>) {

}

export function tc(env : GlobalTypeEnv, program : Array<Stmt>) : [Type, GlobalTypeEnv] {
  const stmtTypes = program.map(s => tcStmt(env, new Map(), s));
  return [stmtTypes.pop(), env];
}

export function tcBlock(env : GlobalTypeEnv, locals : LocalTypeEnv, stmts : Array<Stmt>) {

}

export function tcStmt(env : GlobalTypeEnv, locals : LocalTypeEnv, stmt : Stmt) : Type {
  switch(stmt.tag) {
    case "define":
      return NONE;
    case "expr":
      return tcExpr(env, locals, stmt.expr);
    case "fun":
      return NONE;
    case "if":
      return NONE;
    case "return":
      return NONE;
  }
}

export function tcExpr(env : GlobalTypeEnv, locals : LocalTypeEnv, expr : Expr) : Type {
  switch(expr.tag) {
    case "bool": return BOOL;
    case "num": return NUM;
    default: return NONE;
  }
}