import {
  Stmt,
  Expr,
  Type,
  UniOp,
  BinOp,
  Literal,
  Program,
  FunDef,
  VarInit,
  Class,
  Destructure,
  Assignable,
  ASSIGNABLE_TAGS,
  AssignTarget,
  Parameter,
} from "./ast";
import { NUM, STRING, BOOL, NONE, CLASS, unhandledTag, unreachable, isTagged } from "./utils";
import * as BaseException from "./error";

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
  functions: Map<string, [Array<Parameter>, Type]>;
  classes: Map<string, [Map<string, Type>, Map<string, [Array<Parameter>, Type]>]>;
};

export type LocalTypeEnv = {
  vars: Map<string, Type>;
  expectedRet: Type;
  topLevel: boolean;
};

const defaultGlobalFunctions = new Map();
defaultGlobalFunctions.set("abs", [[{ type: NUM }], NUM]);
defaultGlobalFunctions.set("max", [[{ type: NUM }, { type: NUM }], NUM]);
defaultGlobalFunctions.set("min", [[{ type: NUM }, { type: NUM }], NUM]);
defaultGlobalFunctions.set("pow", [[{ type: NUM }, { type: NUM }], NUM]);
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
    topLevel: true,
  };
}

export type TypeError = {
  message: string;
};

export function equalType(t1: Type, t2: Type) {
  return t1 === t2 || (t1.tag === "class" && t2.tag === "class" && t1.name === t2.name);
}

export function isNoneOrClass(t: Type) {
  return t.tag === "none" || t.tag === "class";
}

export function isSubtype(env: GlobalTypeEnv, t1: Type, t2: Type): boolean {
  return equalType(t1, t2) || (t1.tag === "none" && t2.tag === "class");
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
  program.inits.forEach((init) => newGlobs.set(init.name, init.type));
  program.funs.forEach((fun) => newFuns.set(fun.name, [fun.parameters, fun.ret]));
  //program.funs.forEach(fun => newFuns.set(fun.name, [fun.parameters.map(p => p.type), fun.ret]));
  program.classes.forEach((cls) => {
    const fields = new Map();
    const methods = new Map();
    cls.fields.forEach((field) => fields.set(field.name, field.type));
    cls.methods.forEach(
      (method) => methods.set(method.name, [method.parameters, method.ret])
      //methods.set(method.name, [method.parameters.map((p) => p.type), method.ret])
    );
    newClasses.set(cls.name, [fields, methods]);
  });
  return { globals: newGlobs, functions: newFuns, classes: newClasses };
}

export function tc(env: GlobalTypeEnv, program: Program<null>): [Program<Type>, GlobalTypeEnv] {
  const locals = emptyLocalTypeEnv();
  const newEnv = augmentTEnv(env, program);
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
  const aprogram = { a: lastTyp, inits: tInits, funs: tDefs, classes: tClasses, stmts: tBody };
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
  // type checking defaults
  fun.parameters.forEach((p) => tcDefault(p.type, p.value));
  fun.parameters.forEach((p) => locals.vars.set(p.name, p.type));
  fun.inits.forEach((init) => locals.vars.set(init.name, tcInit(env, init).type));

  const tBody = tcBlock(env, locals, fun.body);
  return { ...fun, a: NONE, body: tBody };
}

export function tcDefault(paramType: Type, paramLiteral: Literal) {
  // no default values
  if (paramLiteral === undefined) {
    return;
  } else if (paramLiteral.tag === "num" && paramType.tag === "number") {
    return;
  } else if (paramLiteral.tag !== paramType.tag) {
    throw new TypeCheckError(
      "Default value type " + paramLiteral.tag + " does not match param type " + paramType.tag
    );
  }
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

export function tcStmt(env: GlobalTypeEnv, locals: LocalTypeEnv, stmt: Stmt<null>): Stmt<Type> {
  switch (stmt.tag) {
    case "assignment":
      const tValueExpr = tcExpr(env, locals, stmt.value);
      return {
        a: NONE,
        tag: stmt.tag,
        value: tValueExpr,
        destruct: tcDestructure(env, locals, stmt.destruct, tValueExpr.a),
      };
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
      const tRet = tcExpr(env, locals, stmt.value);
      if (!isAssignable(env, tRet.a, locals.expectedRet))
        throw new TypeCheckError(
          "expected return type `" +
            (locals.expectedRet as any).name +
            "`; got type `" +
            (tRet.a as any).name +
            "`"
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
    default:
      unhandledTag(stmt);
  }
}

/**
 * Type check a Destructure<null>. This requires explicitly passing in the type of the value this
 * assignment will receive.
 * @param env GlobalTypeEnv
 * @param locals LocalTypeEnv
 * @param destruct Destructure description of assign targets
 * @param value Type of the value passed into this destructure
 */
function tcDestructure(
  env: GlobalTypeEnv,
  locals: LocalTypeEnv,
  destruct: Destructure<null>,
  value: Type
): Destructure<Type> {
  /**
   * Type check an AssignTarget<null>. Ensures that the target is valid and that its type is compatible with the
   * value being assignment
   * @param {AssignTarget<null>} aTarget - The target to be type checked
   * @param {Type} valueType - The type of the value being assigned to the target
   */
  function tcTarget(aTarget: AssignTarget<null>, valueType: Type): AssignTarget<Type> {
    let { target, starred, ignore } = aTarget;
    const tTarget = tcAssignable(env, locals, target);
    const targetType = tTarget.a;
    if (!isAssignable(env, valueType, targetType))
      throw new TypeCheckError(`Non-assignable types: Cannot assign ${valueType} to ${targetType}`);
    return {
      starred,
      ignore,
      target: tTarget,
    };
  }

  if (!destruct.isDestructured) {
    let target = tcTarget(destruct.targets[0], value);
    return {
      valueType: value,
      isDestructured: false,
      targets: [target],
    };
  }

  let types: Type[] = [];
  if (value.tag === "class") {
    // This is a temporary hack to get destructuring working (reuse for tuples later?)
    let cls = env.classes.get(value.name);
    if (cls === undefined)
      throw new Error(
        `Class ${value.name} not found in global environment. This is probably a parsing bug.`
      );
    let attrs = cls[0];
    attrs.forEach((val) => types.push(val));
    let starOffset = 0;
    let tTargets: AssignTarget<Type>[] = destruct.targets.map((target, i, targets) => {
      if (i >= types.length)
        throw new Error(
          `Not enough values to unpack (expected at least ${i}, got ${types.length})`
        );
      if (target.starred) {
        starOffset = types.length - targets.length; // How many values will be assigned to the starred target
        throw new TypeCheckError("Starred values not supported");
      }
      let valueType = types[i + starOffset];
      return tcTarget(target, valueType);
    });

    if (types.length > destruct.targets.length + starOffset)
      throw new Error(
        `Too many values to unpack (expected ${destruct.targets.length}, got ${types.length})`
      );

    return {
      isDestructured: destruct.isDestructured,
      targets: tTargets,
      valueType: value,
    };
  } else {
    throw new TypeCheckError(`Type ${value.tag} cannot be destructured`);
  }
}

function tcAssignable(
  env: GlobalTypeEnv,
  locals: LocalTypeEnv,
  target: Assignable<null>
): Assignable<Type> {
  const expr = tcExpr(env, locals, target);
  if (!isTagged(expr, ASSIGNABLE_TAGS)) {
    throw new TypeCheckError(`Cannot assing to target type ${expr.tag}`);
  }
  return expr;
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
        const [[expectedParam], retTyp] = env.functions.get(expr.name);
        const tArg = tcExpr(env, locals, expr.arg);

        if (isAssignable(env, tArg.a, expectedParam.type)) {
          return { ...expr, a: retTyp, arg: tArg };
        } else {
          throw new TypeError("Function call type mismatch: " + expr.name);
        }
      } else {
        throw new TypeError("Undefined function: " + expr.name);
      }
    case "builtin2":
      if (env.functions.has(expr.name)) {
        const [[leftParam, rightParam], retTyp] = env.functions.get(expr.name);
        const tLeftArg = tcExpr(env, locals, expr.left);
        const tRightArg = tcExpr(env, locals, expr.right);
        if (
          isAssignable(env, leftParam.type, tLeftArg.a) &&
          isAssignable(env, rightParam.type, tRightArg.a)
        ) {
          return { ...expr, a: retTyp, left: tLeftArg, right: tRightArg };
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
      } else if (env.functions.has(expr.name)) {
        const [params, retType] = env.functions.get(expr.name);
        const argTypes = params.map((p) => p.type);
        const tArgs = expr.arguments.map((arg) => tcExpr(env, locals, arg));

        if (
          argTypes.length === expr.arguments.length &&
          tArgs.every((tArg, i) => tArg.a === argTypes[i])
        ) {
          return { ...expr, a: retType, arguments: expr.arguments };
        }
        // case where the function may have default values
        else if (
          argTypes.length > expr.arguments.length &&
          tArgs.every((tArg, i) => tArg.a === argTypes[i])
        ) {
          // check if arguments less than number of parameters
          // first populate all the arguments first.
          // Then, populate the rest of the values with defaults from params
          var augArgs = expr.arguments;
          var argNums = expr.arguments.length;
          while (argNums < argTypes.length) {
            if (params[argNums].value === undefined) {
              throw new Error("Missing argument from call");
            } else {
              // add default values into arguments as an Expr
              augArgs = augArgs.concat({ tag: "literal", value: params[argNums].value });
            }
            argNums = argNums + 1;
          }
          return { ...expr, a: retType, arguments: augArgs };
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
          const [_, methods] = env.classes.get(tObj.a.name);
          if (methods.has(expr.method)) {
            const [methodParams, methodRet] = methods.get(expr.method);
            const methodArgs = methodParams.map((p) => p.type);
            const realArgs = [tObj].concat(tArgs);

            if (
              methodArgs.length === realArgs.length &&
              methodArgs.every((argTyp, i) => isAssignable(env, realArgs[i].a, argTyp))
            ) {
              return { ...expr, a: methodRet, obj: tObj, arguments: tArgs };
            } else if (
              realArgs.length < methodArgs.length &&
              realArgs.every((arg, i) => isAssignable(env, methodArgs[i], arg.a))
            ) {
              var augMethodArgs = tArgs;
              var methodArgNums = realArgs.length;
              while (methodArgNums < methodArgs.length) {
                if (methodParams[methodArgNums].value === undefined) {
                  throw new Error("Missing argument from class method call");
                } else {
                  // add default values into arguments as an Expr
                  augMethodArgs = augMethodArgs.concat({
                    tag: "literal",
                    value: methodParams[methodArgNums].value,
                  });
                }
                methodArgNums = methodArgNums + 1;
              }
              return { ...expr, a: methodRet, obj: tObj, arguments: augMethodArgs };
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
    case "bracket-lookup":
      var obj_t = tcExpr(env, locals, expr.obj);
      var key_t = tcExpr(env, locals, expr.key);
      var tBracketExpr = { ...expr, obj: obj_t, key: key_t, a: obj_t.a };
      if (obj_t.a != STRING) {
        throw new TypeCheckError("Bracket lookup on " + obj_t.a.tag + " type not possible");
      }
      if (key_t.a != NUM) {
        throw new TypeCheckError(
          "Bracket lookup using " + key_t.a.tag + " type as index is not possible"
        );
      }
      return tBracketExpr;
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
    case "string":
      return STRING;
    default:
      unhandledTag(literal);
  }
}
