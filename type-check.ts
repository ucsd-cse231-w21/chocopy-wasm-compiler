
import {Stmt, Expr, Type, Op, Literal, Program, FunDef, VarInit} from './ast';

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

export type LocalTypeEnv = {
  vars: Map<string, Type>,
  expectedRet: Type
}

export function emptyGlobalTypeEnv() : GlobalTypeEnv {
  return {
    globals: new Map(),
    functions: new Map()
  };
}

export function emptyLocalTypeEnv() : LocalTypeEnv {
  return {
    vars: new Map(),
    expectedRet: Type.NONE
  };
}

export type TypeError = {
  message: string
}

export function isSubtype(env : GlobalTypeEnv, t1 : Type, t2 : Type) : boolean {
  if(t1 === t2) { return true; }
  if(t2 === Type.OBJ) { return true; }
  return false;
}

export function isAssignable(env : GlobalTypeEnv, t1 : Type, t2 : Type) : boolean {
  return isSubtype(env, t1, t2);
}

export function join(env : GlobalTypeEnv, t1 : Type, t2 : Type) : Type {
  return Type.NONE
}

export function augmentTEnv(env : GlobalTypeEnv, program : Program) : GlobalTypeEnv {
  const newGlobs = new Map(env.globals);
  const newFuns = new Map(env.functions);
  program.inits.forEach(init => newGlobs.set(init.name, tcInit(init)));
  program.funs.forEach(fun => newFuns.set(fun.name, [fun.parameters.map(p => p.type), fun.ret]));
  return { globals: newGlobs, functions: newFuns };
}

export function tc(env : GlobalTypeEnv, program : Program) : [Type, GlobalTypeEnv] {
  const locals = emptyLocalTypeEnv();
  const newEnv = augmentTEnv(env, program);
  program.funs.forEach(fun => tcDef(newEnv, fun));

  // program.inits.forEach(init => env.globals.set(init.name, tcInit(init)));
  // program.funs.forEach(fun => env.functions.set(fun.name, [fun.parameters.map(p => p.type), fun.ret]));
  // program.funs.forEach(fun => tcDef(env, fun));
  // Strategy here is to allow tcBlock to populate the locals, then copy to the
  // global env afterwards (tcBlock changes locals)
  const lastTyp = tcBlock(newEnv, locals, program.stmts);
  // TODO(joe): check for assignment in existing env vs. new declaration
  // and look for assignment consistency
  for (let name of locals.vars.keys()) {
    newEnv.globals.set(name, locals.vars.get(name));
  }
  return [lastTyp, newEnv];
}

export function tcInit(init : VarInit) : Type {
  const valTyp = tcLiteral(init.value);
  if (init.type === valTyp) {
    return init.type;
  } else {
    throw new TypeCheckError("Expected type `" + init.type + "`; got type `" + valTyp + "`");
  }
}

export function tcDef(env : GlobalTypeEnv, fun : FunDef) : LocalTypeEnv {
  var locals = emptyLocalTypeEnv();
  locals.expectedRet = fun.ret;
  fun.parameters.forEach(p => locals.vars.set(p.name, p.type));
  fun.inits.forEach(init => locals.vars.set(init.name, tcInit(init)));
  
  const retTyp = tcBlock(env, locals, fun.body);
  if (retTyp !== fun.ret) {
    throw new TypeCheckError("function " + fun.name + " has " + retTyp + " return type; type" + fun.ret + " expected");
  }
  return locals;
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
  let lastTyp : Type = Type.NONE;
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
      return Type.NONE;
    case "expr":
      return tcExpr(env, locals, stmt.expr);
    case "if":
      const condTyp = tcExpr(env, locals, stmt.cond);
      const thnTyp = tcBlock(env, locals, stmt.thn);
      const elsTyp = tcBlock(env, locals, stmt.els);
      if (condTyp !== Type.BOOL) {
        throw new TypeCheckError("Condition Expression Must be a bool");
      } else if (thnTyp !== elsTyp) {
        throw new TypeCheckError("Types of then and else branches must match");
      } else{
        return thnTyp;
      }
    case "return":
      const retTyp = tcExpr(env, locals, stmt.value);
      if (retTyp !== locals.expectedRet) {
        throw new TypeCheckError("expected return type `" + locals.expectedRet + "`; got type `" + retTyp + "`");
      } else {
        return retTyp;
      }
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
          if(leftTyp === Type.NUM && rightTyp === Type.NUM) { return Type.NUM; }
          else { throw new TypeCheckError("Type mismatch for numeric op" + expr.op); }
        case Op.Eq:
        case Op.Neq:
          if(leftTyp === rightTyp) { return Type.BOOL; }
          else { throw new TypeCheckError("Type mismatch for op" + expr.op)}
        case Op.Lte:
        case Op.Gte:
        case Op.Lt:
        case Op.Gt:
          if(leftTyp === Type.NUM && rightTyp === Type.NUM) { return Type.BOOL; }
          else { throw new TypeCheckError("Type mismatch for op" + expr.op) }
        case Op.And:
        case Op.Or:
          if(leftTyp === Type.BOOL && rightTyp === Type.BOOL) { return Type.BOOL; }
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
      if(env.functions.has(expr.name)) {
        const [[expectedArgTyp], retTyp] = env.functions.get(expr.name);
        const argTyp = tcExpr(env, locals, expr.arg);
        if(expectedArgTyp === argTyp) {
          return retTyp
        } else if (expr.name === "print") {
          return tcExpr(env, locals, expr.arg);
        } else {
          throw new TypeError("Function call type mismatch: " + expr.name);
        }
      } else {
        throw new TypeError("Undefined function: " + expr.name);
      }
    case "builtin2":
      if(env.functions.has(expr.name)) {
        const [[leftTyp, rightTyp], retTyp] = env.functions.get(expr.name);
        if(tcExpr(env, locals, expr.left) === leftTyp && tcExpr(env, locals, expr.right) === rightTyp) {
          return retTyp
        } else {
          throw new TypeError("Function call type mismatch: " + expr.name);
        }
      } else {
        throw new TypeError("Undefined function: " + expr.name);
      }
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
    default: return Type.NONE;
  }
}

export function tcLiteral(literal : Literal) {
    switch(literal.tag) {
        case "bool": return Type.BOOL;
        case "num": return Type.NUM;
    }
}