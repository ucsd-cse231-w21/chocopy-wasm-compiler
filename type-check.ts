
import {Stmt, Expr} from './ast';

type Type =
    { tag: "num" }
  | { tag: "bool" }
  | { tag: "none" }

type GlobalTypeEnv = {
  globals: Map<string, Type>,
  functions: Map<string, [Array<Type>, Type]>
}

type LocalTypeEnv = Map<string, Type>;

type TypeError = {
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

export function tc(env : GlobalTypeEnv, program : Array<Stmt>) {
  return [];
}

export function tcStmt(env : GlobalTypeEnv, locals : LocalTypeEnv, stmt : Stmt) {
  return [];
}

export function tcExpr(env : GlobalTypeEnv, locals : LocalTypeEnv, expr : Expr) {
  return [];
}