
import {Stmt, Expr, Type, NUM, BOOL, OBJ, NONE, Op, Literal, Program, FunDef} from './ast';

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

export function tc(env : GlobalTypeEnv, program : Program) : [Type, GlobalTypeEnv] {
  const locals = makeEmptyLocals();
  // Strategy here is to allow tcBlock to populate the locals, then copy to the
  // global env afterwards (tcBlock changes locals)
  const lastTyp = tcBlock(env, locals, program.stmts);
  // TODO(joe): check for assignment in existing env vs. new declaration
  // and look for assignment consistency
  for (let name of locals.vars.keys()) {
    env.globals.set(name, locals.vars.get(name));
  }
  return [lastTyp, env];
}

export function tcBlock(env : GlobalTypeEnv, locals : LocalTypeEnv, stmts : Array<Stmt>) : Type {
  // Assume that the block prelude is *just* variable declarations ("define")
  // Per chocopy restrictions. Later nonlocal/global/nested functions come into play
  var curStmt = stmts[0];
  let stmtIndex = 0;
//   while(curStmt.tag === "define") {
//     const typ = tcExpr(env, locals, curStmt.value);
//     locals.vars.set(curStmt.name, typ);
//     curStmt = stmts[++stmtIndex];
//   }
  let lastTyp : Type = NONE;
  while(stmtIndex < stmts.length) {
    lastTyp = tcStmt(env, locals, stmts[stmtIndex]);
    stmtIndex += 1;
  }
  return lastTyp;
}

export function tcStmt(env : GlobalTypeEnv, locals : LocalTypeEnv, stmt : Stmt) : Type {
  switch(stmt.tag) {
    case "assign":
      const valTyp = tcExpr(env, locals, stmt.value);
      var nameTyp;
      if (locals.vars.has(stmt.name)) {
        nameTyp = locals.vars.get(stmt.name);
      } else if (env.globals.has(stmt.name)) {
        nameTyp = env.globals.get(stmt.name);
      } else {
        throw new TypeCheckError("Unbound id: " + stmt.name);
      }
      if(!isAssignable(env, valTyp, nameTyp)) {
        throw new TypeCheckError("Non-assignable types");
      }
      return NONE;
    case "expr":
      return tcExpr(env, locals, stmt.expr);
    case "if":
      const condTyp = tcExpr(env, locals, stmt.cond);
      const thnTyp = tcBlock(env, locals, stmt.thn);
      const elsTyp = tcBlock(env, locals, stmt.els);
      if (condTyp !== BOOL) {
        throw new TypeCheckError("Condition Expression Must be a bool");
      } else if (thnTyp !== elsTyp) {
        throw new TypeCheckError("Types of then and else branches must match");
      } else{
        return thnTyp;
      }
    case "return":
      tcExpr(env, locals, stmt.value);
      return NONE;
  }
}

export function tcExpr(env : GlobalTypeEnv, locals : LocalTypeEnv, expr : Expr) : Type {
  switch(expr.tag) {
    case "literal": 
      return tcLiteral(expr.value);
    case "op":
      const leftTyp = tcExpr(env, locals, expr.left);
      const rightTyp = tcExpr(env, locals, expr.right);
      switch(expr.op) {
        case Op.Plus:
        case Op.Minus:
        case Op.Mul:
        case Op.IDiv:
        case Op.Mod:
          if(leftTyp === NUM && rightTyp === NUM) { return NUM; }
          else { throw new TypeCheckError("Type mismatch for numeric op" + expr.op); }
        case Op.Eq:
        case Op.Neq:
          if(leftTyp === rightTyp) { return BOOL; }
          else { throw new TypeCheckError("Type mismatch for op" + expr.op)}
        case Op.Lte:
        case Op.Gte:
        case Op.Lt:
        case Op.Gt:
          if(leftTyp === NUM && rightTyp === NUM) { return BOOL; }
          else { throw new TypeCheckError("Type mismatch for op" + expr.op) }
        case Op.And:
        case Op.Or:
          if(leftTyp === BOOL && rightTyp === BOOL) { return BOOL; }
          else { throw new TypeCheckError("Type mismatch for boolean op" + expr.op); }
        case Op.Is:
          throw new Error("is not implemented yet");
      }
    case "id":
      if (locals.vars.has(expr.name)) {
        return locals.vars.get(expr.name);
      } else if (env.globals.has(expr.name)) {
        return env.globals.get(expr.name);
      } else {
        throw new TypeCheckError("Unbound id: " + expr.name);
      }
    case "builtin1":
      if (expr.name === "print") {
        return tcExpr(env, locals, expr.arg);
      } else {
        throw new Error("Type checking is unimplemented for: " + expr.name);
      }
    case "builtin2":
      throw new Error("Type checking is unimplemented for: " + expr.name);
    case "call":
      if(env.functions.has(expr.name)) {
        const [argTypes, retType] = env.functions.get(expr.name);
        if(argTypes.length === expr.arguments.length &&
           expr.arguments.every((argT, i) => tcExpr(env, locals, argT) === argTypes[i])) {
             return retType
           } else {
            throw new TypeError("Function call type mismatch: " + expr.name);
           }
      } else {
        throw new TypeError("Undefined function: " + expr.name);
      }
    default: return NONE;
  }
}

export function tcLiteral(literal : Literal) {
    switch(literal.tag) {
        case "bool": return BOOL;
        case "num": return NUM;
    }
}