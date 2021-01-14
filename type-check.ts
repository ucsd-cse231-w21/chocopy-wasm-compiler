
import {Stmt, Expr, Type, NUM, BOOL, OBJ, NONE, Op} from './ast';

// I ❤️ TypeScript: https://github.com/microsoft/TypeScript/issues/13965
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
  if(t1 === t2) { return true; }
  if(t2 === OBJ) { return true; }
  return false;
}

export function isAssignable(env : GlobalTypeEnv, t1 : Type, t2 : Type) : boolean {
  return isSubtype(env, t1, t2);
}

export function join(env : GlobalTypeEnv, t1 : Type, t2 : Type) : Type {
  return { tag: "none" }
}

export function updateGlobalTypeEnv(env : GlobalTypeEnv, program : Array<Stmt>) {

}

export function tc(env : GlobalTypeEnv, program : Array<Stmt>) : [Type, GlobalTypeEnv] {
  const locals = makeEmptyLocals();
  // Strategy here is to allow tcBlock to populate the locals, then copy to the
  // global env afterwards (tcBlock changes locals)
  const lastTyp = tcBlock(env, locals, program);
  // TODO(joe): check for assignment in existing env vs. new declaration
  // and look for assignment consistency
  for (let name of locals.vars.keys()) {
    env.globals.set(name, locals.vars.get(name));
  }
  return [lastTyp, env];
}

export function tcBlock(env : GlobalTypeEnv, locals : LocalTypeEnv, stmts : Array<Stmt>) {
  // Assume that the block prelude is *just* variable declarations ("define")
  // Per chocopy restrictions. Later nonlocal/global/nested functions come into play
  var curStmt = stmts[0];
  let stmtIndex = 0;
  while(curStmt.tag === "define") {
    const typ = tcExpr(env, locals, curStmt.value);
    locals.vars.set(curStmt.name, typ);
    curStmt = stmts[++stmtIndex];
  }
  let lastTyp : Type = NONE;
  while(stmtIndex < stmts.length) {
    lastTyp = tcStmt(env, locals, stmts[stmtIndex]);
    stmtIndex += 1;
  }
  return lastTyp;
}

export function tcStmt(env : GlobalTypeEnv, locals : LocalTypeEnv, stmt : Stmt) : Type {
  switch(stmt.tag) {
    case "define":
      const valTyp = tcExpr(env, locals, stmt.value);
      const nameTyp = locals.vars.get(stmt.name);
      if(!isAssignable(env, valTyp, nameTyp)) {
        throw new TypeCheckError("Non-assignable types");
      }
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
          else { throw new TypeCheckError("Type mismatch for numeric op" + expr.op); }
        case Op.And:
        case Op.Or:
          if(leftTyp === BOOL && rightTyp === BOOL) { return BOOL; }
          else { throw new TypeCheckError("Type mismatch for boolean op" + expr.op); }
      }
    case "id":
      if(!locals.vars.has(expr.name)) { throw new TypeCheckError("Unbound id: " + expr.name); }
      return locals.vars.get(expr.name);
    default: return NONE;
  }
}