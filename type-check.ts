
import {Stmt, Expr, Type, NUM, BOOL, OBJ, NONE, Op} from './ast';

// I ❤️ JavaScript: https://github.com/microsoft/TypeScript/issues/13965
export class TypeCheckError extends Error {
   __proto__: Error
   constructor(message?: string) {
    const trueProto = new.target.prototype;
    super(message);

    // Alternatively use Object.setPrototypeOf if you have an ES6 environment.
    this.__proto__ = trueProto;
  } 
}

export type GlobalTypeEnv = {
  globals: Map<string, Type>,
  functions: Map<string, [Array<Type>, Type]>
}

type LocalTypeEnv = {
  vars: Map<string, Type>,
  expectedRet: Type
}

function makeEmptyLocals() {
  return {
    vars: new Map(),
    expectedRet: NONE
  };
}

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
  const stmtTypes = program.map(s => tcStmt(env, makeEmptyLocals(), s));
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
    case "op":
      const leftTyp = tcExpr(env, locals, expr.left);
      const rightTyp = tcExpr(env, locals, expr.right);
      switch(expr.op) {
        case Op.Plus:
        case Op.Minus:
        case Op.Mul:
          if(leftTyp === NUM && rightTyp === NUM) { return NUM; }
          else { throw new TypeCheckError("Type mismatch for " + expr.op); }
        case Op.And:
        case Op.Or:
          if(leftTyp === BOOL && rightTyp === BOOL) { return BOOL; }
          else { throw new TypeCheckError("Type mismatch for " + expr.op); }
      }
    default: return NONE;
  }
}