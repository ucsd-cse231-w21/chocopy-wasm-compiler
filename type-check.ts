import { Stmt, Expr, Type, UniOp, BinOp, Literal, Program, FunDef, VarInit, Class } from "./ast";
import { NUM, BOOL, NONE, CLASS, unhandledTag, unreachable } from "./utils";

// I ❤️ TypeScript: https://github.com/microsoft/TypeScript/issues/13965
export class TypeCheckError extends Error {
  __proto__: Error;
  constructor(message?: string) {
    const trueProto = new.target.prototype;
    super(message);

    // Alternatively use Object.setPrototypeOf if you have an ES6 environment.
    this.__proto__ = trueProto;
  }
}

export type GlobalTypeEnv = {
  globals: Map<string, Type>;
  functions: Map<string, [Array<Type>, Type]>;
  classes: Map<string, [Map<string, Type>, Map<string, [Array<Type>, Type]>]>;
};

export type LocalTypeEnv = {
  vars: Map<string, Type>;
  expectedRet: Type;
  functions: Map<string, [Array<Type>, Type]>;
  topLevel: boolean;
};

const defaultGlobalFunctions = new Map();
defaultGlobalFunctions.set("abs", [[NUM], NUM]);
defaultGlobalFunctions.set("max", [[NUM, NUM], NUM]);
defaultGlobalFunctions.set("min", [[NUM, NUM], NUM]);
defaultGlobalFunctions.set("pow", [[NUM, NUM], NUM]);
defaultGlobalFunctions.set("print", [[CLASS("object")], NUM]);

export const defaultTypeEnv = {
  globals: new Map(),
  functions: defaultGlobalFunctions,
  classes: new Map(),
};

export function emptyGlobalTypeEnv(): GlobalTypeEnv {
  return {
    globals: new Map(),
    functions: new Map(),
    classes: new Map(),
  };
}

export function emptyLocalTypeEnv(): LocalTypeEnv {
  return {
    vars: new Map(),
    expectedRet: NONE,
    functions: new Map(),
    topLevel: true,
  };
}

export type TypeError = {
  message: string;
};

export function equalType(t1: Type, t2: Type) {
  return (
    t1 === t2 ||
    (t1.tag === "class" && t2.tag === "class" && t1.name === t2.name) ||
    (t1.tag === "callable" && t2.tag === "callable" && equalCallabale(t1, t2))
  );
}

export function equalCallabale(t1: Type, t2: Type): boolean {
  if (t1.tag === "callable" && t2.tag === "callable") {
    if (t1.args.length !== t2.args.length) {
      return false;
    }
    for (var i = 0; i < t1.args.length; i++) {
      if (!equalType(t1.args[i], t2.args[i])) {
        return false;
      }
    }
    return equalType(t1.ret, t2.ret);
  }
  return false;
}

export function isNoneOrClass(t: Type) {
  return t.tag === "none" || t.tag === "class";
}

export function isSubtype(env: GlobalTypeEnv, t1: Type, t2: Type): boolean {
  return (
    equalType(t1, t2) ||
    (t1.tag === "none" && t2.tag === "class") ||
    (t1.tag === "none" && t2.tag === "callable")
  );
}

export function isAssignable(env: GlobalTypeEnv, t1: Type, t2: Type): boolean {
  return isSubtype(env, t1, t2);
}

export function join(env: GlobalTypeEnv, t1: Type, t2: Type): Type {
  return NONE;
}

export function augmentTEnv(env: GlobalTypeEnv, program: Program<null>): GlobalTypeEnv {
  const newGlobs = new Map(env.globals);
  const newFuns = new Map(env.functions);
  const newClasses = new Map(env.classes);
  program.inits.forEach((init) => {
    if (newGlobs.has(init.name)) {
      throw new TypeCheckError(`Duplicate variable ${init.name}`);
    }
    newGlobs.set(init.name, init.type);
  });
  program.funs.forEach((fun) => {
    newFuns.set(fun.name, [fun.parameters.map((p) => p.type), fun.ret]);
    if (newGlobs.has(fun.name)) {
      throw new TypeCheckError(`Duplicate variable ${fun.name}`);
    }
    newGlobs.set(fun.name, {
      tag: "callable",
      args: fun.parameters.map((p) => p.type),
      ret: fun.ret,
    });
  });

  program.classes.forEach((cls) => {
    const fields = new Map();
    const methods = new Map();
    cls.fields.forEach((field) => {
      if (fields.has(field.name)) {
        throw new TypeCheckError(`Duplicate variable ${field.name}`);
      }
      fields.set(field.name, field.type);
    });
    cls.methods.forEach((method) => {
      methods.set(method.name, [method.parameters.map((p) => p.type), method.ret]);
      if (fields.has(method.name)) {
        throw new TypeCheckError(`Duplicate variable ${method.name}`);
      }
      fields.set(method.name, {
        tag: "callable",
        args: method.parameters.map((p) => p.type),
        ret: method.ret,
      });
    });
    newClasses.set(cls.name, [fields, methods]);
  });
  return { globals: newGlobs, functions: newFuns, classes: newClasses };
}

export function tc(env: GlobalTypeEnv, program: Program<null>): [Program<Type>, GlobalTypeEnv] {
  const locals = emptyLocalTypeEnv();
  const newEnv = augmentTEnv(env, program);
  // console.log(newEnv);
  const tInits = program.inits.map((init) => tcInit(env, init));
  const tDefs = program.funs.map((fun) => tcDef(newEnv, fun));
  const tClasses = program.classes.map((cls) => tcClass(newEnv, cls));

  // program.inits.forEach(init => env.globals.set(init.name, tcInit(init)));
  // program.funs.forEach(fun => env.functions.set(fun.name, [fun.parameters.map(p => p.type), fun.ret]));
  // program.funs.forEach(fun => tcDef(env, fun));
  // Strategy here is to allow tcBlock to populate the locals, then copy to the
  // global env afterwards (tcBlock changes locals)
  const tBody = tcBlock(newEnv, locals, program.stmts);
  var lastTyp: Type = NONE;
  if (tBody.length) {
    lastTyp = tBody[tBody.length - 1].a;
  }
  // TODO(joe): check for assignment in existing env vs. new declaration
  // and look for assignment consistency
  for (let name of locals.vars.keys()) {
    newEnv.globals.set(name, locals.vars.get(name));
  }
  const aprogram: Program<Type> = {
    a: lastTyp,
    inits: tInits,
    funs: tDefs,
    classes: tClasses,
    stmts: tBody,
    closures: [],
  };
  return [aprogram, newEnv];
}

export function tcInit(env: GlobalTypeEnv, init: VarInit<null>): VarInit<Type> {
  const valTyp = tcLiteral(init.value);
  if (isAssignable(env, valTyp, init.type)) {
    return { ...init, a: NONE };
  } else {
    throw new TypeCheckError("Expected type `" + init.type + "`; got type `" + valTyp + "`");
  }
}

export function tcDef(env: GlobalTypeEnv, fun: FunDef<null>): FunDef<Type> {
  var locals = emptyLocalTypeEnv();
  locals.expectedRet = fun.ret;
  locals.topLevel = false;

  fun.parameters.forEach((p) => {
    if (locals.vars.has(p.name)) {
      throw new TypeCheckError(`Duplicate variable ${p.name}`);
    }
    locals.vars.set(p.name, p.type);
  });
  fun.inits.forEach((init) => {
    if (locals.vars.has(init.name)) {
      throw new TypeCheckError(`Duplicate variable ${init.name}`);
    }
    locals.vars.set(init.name, tcInit(env, init).type);
  });
  fun.decls.forEach((decl) => {
    throw new Error(`Invalid Nonlocal Variable ${decl.name}`);
  });
  fun.funs.forEach((func) => {
    locals.functions.set(func.name, [func.parameters.map((p) => p.type), func.ret]);
    if (locals.vars.has(func.name)) {
      throw new TypeCheckError(`Duplicate variable ${func.name}`);
    }
    locals.vars.set(func.name, {
      tag: "callable",
      args: func.parameters.map((p) => p.type),
      ret: func.ret,
    });
  });

  const tDefs = fun.funs.map((fun) => tcNestDef(env, locals, fun));
  const tBody = tcBlock(env, locals, fun.body);
  return { ...fun, a: NONE, funs: tDefs, body: tBody };
}

export function tcNestDef(
  env: GlobalTypeEnv,
  nestEnv: LocalTypeEnv,
  fun: FunDef<null>
): FunDef<Type> {
  var locals = emptyLocalTypeEnv();
  locals.expectedRet = fun.ret;
  locals.topLevel = false;

  fun.parameters.forEach((p) => {
    if (locals.vars.has(p.name)) {
      throw new TypeCheckError(`Duplicate variable ${p.name}`);
    }
    locals.vars.set(p.name, p.type);
  });
  fun.inits.forEach((init) => {
    if (locals.vars.has(init.name)) {
      throw new TypeCheckError(`Duplicate variable ${init.name}`);
    }
    locals.vars.set(init.name, tcInit(env, init).type);
  });
  fun.decls.forEach((decl) => {
    if (locals.vars.has(decl.name) || !nestEnv.vars.has(decl.name)) {
      throw new Error(`Invalid Nonlocal Variable ${decl.name}`);
    }
  });

  fun.funs.forEach((func) => {
    locals.functions.set(func.name, [func.parameters.map((p) => p.type), func.ret]);
    if (locals.vars.has(func.name)) {
      throw new TypeCheckError(`Duplicate variable ${func.name}`);
    }
    locals.vars.set(func.name, {
      tag: "callable",
      args: func.parameters.map((p) => p.type),
      ret: func.ret,
    });
  });

  // console.log(`Nested Env:  !!!!`);
  // console.log(locals);
  nestEnv.vars.forEach((vtype, vname) => {
    if (!locals.vars.has(vname)) {
      locals.vars.set(vname, vtype);
    }
  });
  nestEnv.functions.forEach((vtype, vname) => {
    if (!locals.functions.has(vname)) {
      locals.functions.set(vname, vtype);
    }
  });

  const tDefs = fun.funs.map((fun) => tcNestDef(env, locals, fun));
  const tBody = tcBlock(env, locals, fun.body);
  return { ...fun, a: NONE, funs: tDefs, body: tBody };
}

export function tcClass(env: GlobalTypeEnv, cls: Class<null>): Class<Type> {
  const tFields = cls.fields.map((field) => tcInit(env, field));
  const tMethods = cls.methods.map((method) => tcDef(env, method));
  return { a: NONE, name: cls.name, fields: tFields, methods: tMethods };
}

export function tcBlock(
  env: GlobalTypeEnv,
  locals: LocalTypeEnv,
  stmts: Array<Stmt<null>>
): Array<Stmt<Type>> {
  return stmts.map((stmt) => tcStmt(env, locals, stmt));
}

export function tcLambda(locals: LocalTypeEnv, expr: Expr<null>, expected: Type) {
  if (expr.tag === "lambda" && expected.tag === "callable") {
    var args = expr.args;
    if (args.length === expected.args.length) {
      for (var i = 0; i < args.length; i++) {
        locals.vars.set(args[i], expected.args[i]);
      }
    } else {
      throw new TypeError("Function call type mismatch: Lambda");
    }
  }
}

export function tcStmt(env: GlobalTypeEnv, locals: LocalTypeEnv, stmt: Stmt<null>): Stmt<Type> {
  switch (stmt.tag) {
    case "assignment":
      throw new TypeCheckError("Destructured assignment not implemented");
    case "assign":
      var nameTyp;
      if (locals.vars.has(stmt.name)) {
        nameTyp = locals.vars.get(stmt.name);
      } else if (env.globals.has(stmt.name)) {
        nameTyp = env.globals.get(stmt.name);
      } else throw new TypeCheckError("Unbound id: " + stmt.name);

      if (stmt.value.tag === "lambda") {
        tcLambda(locals, stmt.value, nameTyp);
      }
      // if (nameTyp.tag === "callable" && stmt.value.tag === "lambda") {
      //   var args = stmt.value.args
      //   var ret = stmt.value.ret
      //   if (args.length === nameTyp.args.length) {
      //     for (var i = 0; i < args.length; i++) {
      //       locals.vars.set(args[i], nameTyp.args[i])
      //     }
      //   } else {
      //     throw new TypeError("Function call type mismatch: " + stmt.name);
      //   }
      // }

      const tValExpr = tcExpr(env, locals, stmt.value);
      if (!isAssignable(env, tValExpr.a, nameTyp)) throw new TypeCheckError("Non-assignable types");
      return { a: NONE, tag: stmt.tag, name: stmt.name, value: tValExpr };
    case "expr":
      const tExpr = tcExpr(env, locals, stmt.expr);
      return { a: tExpr.a, tag: stmt.tag, expr: tExpr };
    case "if":
      var tCond = tcExpr(env, locals, stmt.cond);
      const tThn = tcBlock(env, locals, stmt.thn);
      const thnTyp = tThn[tThn.length - 1].a;
      const tEls = tcBlock(env, locals, stmt.els);
      const elsTyp = tEls[tEls.length - 1].a;
      if (tCond.a !== BOOL) throw new TypeCheckError("Condition Expression Must be a bool");
      else if (thnTyp !== elsTyp)
        throw new TypeCheckError("Types of then and else branches must match");
      return { a: thnTyp, tag: stmt.tag, cond: tCond, thn: tThn, els: tEls };
    case "return":
      if (locals.topLevel) throw new TypeCheckError("cannot return outside of functions");

      if (stmt.value.tag === "lambda" && locals.expectedRet.tag === "callable") {
        var args = stmt.value.args;
        var ret = stmt.value.ret;
        if (args.length === locals.expectedRet.args.length) {
          for (var i = 0; i < args.length; i++) {
            locals.vars.set(args[i], locals.expectedRet.args[i]);
          }
        } else throw new TypeError("Function call type mismatch: Lambda");
      }

      const tRet = tcExpr(env, locals, stmt.value);
      if (!isAssignable(env, tRet.a, locals.expectedRet))
        throw new TypeCheckError(
          `expected return type\`${(locals.expectedRet as any).name}\`; got type \`${
            (tRet.a as any).name
          }\``
        );
      return { a: tRet.a, tag: stmt.tag, value: tRet };
    case "while":
      var tCond = tcExpr(env, locals, stmt.cond);
      const tBody = tcBlock(env, locals, stmt.body);
      if (!equalType(tCond.a, BOOL))
        throw new TypeCheckError("Condition Expression Must be a bool");
      return { a: NONE, tag: stmt.tag, cond: tCond, body: tBody };
    case "pass":
      return { a: NONE, tag: stmt.tag };
    case "field-assign":
      var tObj = tcExpr(env, locals, stmt.obj);

      if (tObj.a.tag !== "class") throw new TypeCheckError("field assignments require an object");
      if (!env.classes.has(tObj.a.name))
        throw new TypeCheckError("field assignment on an unknown class");
      const [fields, _] = env.classes.get(tObj.a.name);
      if (!fields.has(stmt.field))
        throw new TypeCheckError(`could not find field ${stmt.field} in class ${tObj.a.name}`);

      if (stmt.value.tag === "lambda") {
        tcLambda(locals, stmt.value, fields.get(stmt.field));
      }
      const tVal = tcExpr(env, locals, stmt.value);
      if (!isAssignable(env, tVal.a, fields.get(stmt.field)))
        throw new TypeCheckError(
          `could not assign value of type: ${tVal.a}; field ${
            stmt.field
          } expected type: ${fields.get(stmt.field)}`
        );
      return { ...stmt, a: NONE, obj: tObj, value: tVal };
    default:
      unhandledTag(stmt);
  }
}

export function tcExpr(env: GlobalTypeEnv, locals: LocalTypeEnv, expr: Expr<null>): Expr<Type> {
  switch (expr.tag) {
    case "literal":
      return { ...expr, a: tcLiteral(expr.value) };
    case "binop":
      const tLeft = tcExpr(env, locals, expr.left);
      const tRight = tcExpr(env, locals, expr.right);
      const tBin = { ...expr, left: tLeft, right: tRight };
      switch (expr.op) {
        case BinOp.Plus:
        case BinOp.Minus:
        case BinOp.Mul:
        case BinOp.IDiv:
        case BinOp.Mod:
          if (equalType(tLeft.a, NUM) && equalType(tRight.a, NUM)) {
            return { a: NUM, ...tBin };
          } else {
            throw new TypeCheckError("Type mismatch for numeric op" + expr.op);
          }
        case BinOp.Eq:
        case BinOp.Neq:
          if (equalType(tLeft.a, tRight.a)) {
            return { a: BOOL, ...tBin };
          } else {
            throw new TypeCheckError("Type mismatch for op" + expr.op);
          }
        case BinOp.Lte:
        case BinOp.Gte:
        case BinOp.Lt:
        case BinOp.Gt:
          if (equalType(tLeft.a, NUM) && equalType(tRight.a, NUM)) {
            return { a: BOOL, ...tBin };
          } else {
            throw new TypeCheckError("Type mismatch for op" + expr.op);
          }
        case BinOp.And:
        case BinOp.Or:
          if (equalType(tLeft.a, BOOL) && equalType(tRight.a, BOOL)) {
            return { a: BOOL, ...tBin };
          } else {
            throw new TypeCheckError("Type mismatch for boolean op" + expr.op);
          }
        case BinOp.Is:
          if (!isNoneOrClass(tLeft.a) || !isNoneOrClass(tRight.a))
            throw new TypeCheckError("is operands must be objects");
          return { a: BOOL, ...tBin };
        default:
          return unreachable(expr);
      }
    case "uniop":
      const tExpr = tcExpr(env, locals, expr.expr);
      const tUni = { ...expr, a: tExpr.a, expr: tExpr };
      switch (expr.op) {
        case UniOp.Neg:
          if (equalType(tExpr.a, NUM)) {
            return tUni;
          } else {
            throw new TypeCheckError("Type mismatch for op" + expr.op);
          }
        case UniOp.Not:
          if (equalType(tExpr.a, BOOL)) {
            return tUni;
          } else {
            throw new TypeCheckError("Type mismatch for op" + expr.op);
          }
        default:
          return unreachable(expr);
      }
    case "id":
      if (locals.vars.has(expr.name)) {
        return { a: locals.vars.get(expr.name), ...expr };
      } else if (env.globals.has(expr.name)) {
        return { a: env.globals.get(expr.name), ...expr };
      } else {
        throw new TypeCheckError("Unbound id: " + expr.name);
      }
    case "builtin1":
      if (expr.name === "print") {
        const tArg = tcExpr(env, locals, expr.arg);
        return { ...expr, a: tArg.a, arg: tArg };
      } else if (env.functions.has(expr.name)) {
        const [[expectedArgTyp], retTyp] = env.functions.get(expr.name);
        const tArg = tcExpr(env, locals, expr.arg);

        if (isAssignable(env, tArg.a, expectedArgTyp)) {
          return { ...expr, a: retTyp, arg: tArg };
        } else {
          throw new TypeError("Function call type mismatch: " + expr.name);
        }
      } else {
        throw new TypeError("Undefined function: " + expr.name);
      }
    case "builtin2":
      if (env.functions.has(expr.name)) {
        const [[leftTyp, rightTyp], retTyp] = env.functions.get(expr.name);
        const tLeftArg = tcExpr(env, locals, expr.left);
        const tRightArg = tcExpr(env, locals, expr.right);
        if (isAssignable(env, leftTyp, tLeftArg.a) && isAssignable(env, rightTyp, tRightArg.a)) {
          return { ...expr, a: retTyp, left: tLeftArg, right: tRightArg };
        } else {
          throw new TypeError("Function call type mismatch: " + expr.name);
        }
      } else {
        throw new TypeError("Undefined function: " + expr.name);
      }
    case "lambda":
      var args: Type[] = [];
      expr.args.forEach((arg) => args.push(locals.vars.get(arg)));
      var callable: Type = { tag: "callable", args, ret: tcExpr(env, locals, expr.ret).a };
      return { ...expr, a: callable };
    case "call_expr":
      var callee = tcExpr(env, locals, expr.name);
      if (callee.a.tag === "callable") {
        const [args, ret] = [callee.a.args, callee.a.ret];
        const tArgs = expr.arguments.map((arg) => tcExpr(env, locals, arg));

        if (
          args.length === expr.arguments.length &&
          tArgs.every((tArg, i) => isAssignable(env, tArg.a, args[i]))
        ) {
          return { ...expr, a: ret, name: callee, arguments: tArgs };
        } else {
          throw new TypeError("Function call type mismatch: " + expr.name);
        }
      } else {
        throw new TypeError("Undefined function: " + expr.name);
      }
    case "call":
      if (env.classes.has(expr.name)) {
        // surprise surprise this is actually a constructor
        const tConstruct: Expr<Type> = { a: CLASS(expr.name), tag: "construct", name: expr.name };
        const [_, methods] = env.classes.get(expr.name);
        if (methods.has("__init__")) {
          const [initArgs, initRet] = methods.get("__init__");
          if (expr.arguments.length !== initArgs.length - 1)
            throw new TypeCheckError(
              "__init__ didn't receive the correct number of arguments from the constructor"
            );
          if (initRet !== NONE) throw new TypeCheckError("__init__  must have a void return type");
          return tConstruct;
        } else {
          return tConstruct;
        }
      } else if (env.globals.has(expr.name) || locals.vars.has(expr.name)) {
        var argTypes: Type[];
        var retType: Type;
        if (locals.vars.has(expr.name)) {
          var temp = locals.vars.get(expr.name);
          // should always be true
          if (temp.tag === "callable") {
            [argTypes, retType] = [temp.args, temp.ret];
          }
        } else {
          var temp = env.globals.get(expr.name);
          if (temp.tag === "callable") {
            [argTypes, retType] = [temp.args, temp.ret];
          }
        }

        const tArgs = expr.arguments.map((arg) => tcExpr(env, locals, arg));

        if (
          argTypes.length === expr.arguments.length &&
          tArgs.every((tArg, i) => isAssignable(env, tArg.a, argTypes[i]))
        ) {
          return { ...expr, a: retType, arguments: tArgs };
        } else {
          throw new TypeError("Function call type mismatch: " + expr.name);
        }
      } else {
        throw new TypeError("Undefined function: " + expr.name);
      }
    case "lookup":
      var tObj = tcExpr(env, locals, expr.obj);
      if (tObj.a.tag === "class") {
        if (env.classes.has(tObj.a.name)) {
          const [fields, _] = env.classes.get(tObj.a.name);
          if (fields.has(expr.field)) {
            return { ...expr, a: fields.get(expr.field), obj: tObj };
          } else {
            throw new TypeCheckError(`could not found field ${expr.field} in class ${tObj.a.name}`);
          }
        } else {
          throw new TypeCheckError("field lookup on an unknown class");
        }
      } else {
        throw new TypeCheckError("field lookups require an object");
      }
    case "method-call":
      var tObj = tcExpr(env, locals, expr.obj);
      var tArgs = expr.arguments.map((arg) => tcExpr(env, locals, arg));
      if (tObj.a.tag === "class") {
        if (env.classes.has(tObj.a.name)) {
          const [fields, methods] = env.classes.get(tObj.a.name);
          // if (methods.has(expr.method)) {
          // const [methodArgs, methodRet] = methods.get(expr.method);
          // const realArgs = [tObj].concat(tArgs);

          var methodArgs: Type[];
          var methodRet: Type;
          if (fields.has(expr.method)) {
            var temp = fields.get(expr.method);
            // should always be true
            if (temp.tag === "callable") {
              [methodArgs, methodRet] = [temp.args, temp.ret];
            }

            var realArgs: Expr<Type>[] = tArgs;
            if (methods.has(expr.method)) {
              realArgs = [tObj].concat(tArgs);
            }
            if (
              methodArgs.length === realArgs.length &&
              methodArgs.every((argTyp, i) => isAssignable(env, realArgs[i].a, argTyp))
            ) {
              return { ...expr, a: methodRet, obj: tObj, arguments: tArgs };
            } else {
              throw new TypeCheckError(
                `Method call type mismatch: ${expr.method} --- callArgs: ${JSON.stringify(
                  realArgs
                )}, methodArgs: ${JSON.stringify(methodArgs)}`
              );
            }
          } else {
            throw new TypeCheckError(
              `could not found method ${expr.method} in class ${tObj.a.name}`
            );
          }
        } else {
          throw new TypeCheckError("method call on an unknown class");
        }
      } else {
        throw new TypeCheckError("method calls require an object");
      }
    default:
      throw new TypeCheckError(`unimplemented type checking for expr: ${expr}`);
  }
}

export function tcLiteral(literal: Literal) {
  switch (literal.tag) {
    case "bool":
      return BOOL;
    case "num":
      return NUM;
    case "none":
      return NONE;
    default:
      unhandledTag(literal);
  }
}
