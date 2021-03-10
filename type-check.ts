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
  functions: Map<string, [Array<Type>, Type]>;
  classes: Map<string, [Map<string, Type>, Map<string, [Array<Type>, Type]>]>;
};

export type LocalTypeEnv = {
  vars: Map<string, Type>;
  expectedRet: Type;
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
    topLevel: true,
  };
}

export type TypeError = {
  message: string;
};

export function equalType(t1: Type, t2: Type): boolean {
  return (
    // ensure deep match for nested types (example: [int,[int,int]])
    JSON.stringify(t1) === JSON.stringify(t2) ||
    (t1.tag === "class" && t2.tag === "class" && t1.name === t2.name) ||
    //if dictionary is initialized to empty {}, then we check for "none" type in key and value
    (t1.tag === "dict" && t2.tag === "dict" && t1.key.tag === "none" && t1.value.tag === "none") ||
    (t1.tag === "list" && t2.tag === "list" && equalType(t1.content_type, t2.content_type))
  );
}

export function isNoneOrClass(t: Type) {
  return t.tag === "none" || t.tag === "class";
}

export function isSubtype(env: GlobalTypeEnv, t1: Type, t2: Type): boolean {
  return (
    equalType(t1, t2) ||
    (t1.tag === "none" && (t2.tag === "class" || t2.tag === "dict" || t2.tag === "list"))
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
  program.inits.forEach((init) => newGlobs.set(init.name, init.type));
  program.funs.forEach((fun) =>
    newFuns.set(fun.name, [fun.parameters.map((p) => p.type), fun.ret])
  );
  program.classes.forEach((cls) => {
    const fields = new Map();
    const methods = new Map();
    cls.fields.forEach((field) => fields.set(field.name, field.type));
    cls.methods.forEach((method) =>
      methods.set(method.name, [method.parameters.map((p) => p.type), method.ret])
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
  fun.parameters.forEach((p) => locals.vars.set(p.name, p.type));
  fun.inits.forEach((init) => locals.vars.set(init.name, tcInit(env, init).type));

  const tBody = tcBlock(env, locals, fun.body);
  return { ...fun, a: NONE, body: tBody };
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
    // throw new TypeCheckError("bracket-assign not implemented");
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
          if (expr.op == BinOp.Plus && tLeft.a.tag === "list" && equalType(tLeft.a, tRight.a)) {
            return { a: tLeft.a, ...tBin };
          }
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
        const [argTypes, retType] = env.functions.get(expr.name);
        const tArgs = expr.arguments.map((arg) => tcExpr(env, locals, arg));

        if (
          argTypes.length === expr.arguments.length &&
          tArgs.every((tArg, i) => tArg.a === argTypes[i])
        ) {
          return { ...expr, a: retType, arguments: expr.arguments };
        } else {
          throw new TypeError("Function call type mismatch: " + expr.name);
        }
      } else if (expr.name === "dict") {
        if (expr.arguments.length !== 1) {
          throw new TypeError(
            "Expected only 1 argument in function call: " +
              expr.name +
              "; got " +
              expr.arguments.length
          );
        }
        let tArg = expr.arguments.map((arg) => tcExpr(env, locals, arg));
        let tRet = tArg[0].a; //dict constructor will take only 1 argument
        if (tArg[0].a.tag !== "dict") {
          throw new TypeError(
            "Function call type mismatch: " + expr.name + ". Expected dict type as an argument."
          );
        }
        return { ...expr, a: tRet, arguments: tArg };
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
      let tArgs = expr.arguments.map((arg) => tcExpr(env, locals, arg));
      if (tObj.a.tag === "class") {
        if (env.classes.has(tObj.a.name)) {
          const [_, methods] = env.classes.get(tObj.a.name);
          if (methods.has(expr.method)) {
            const [methodArgs, methodRet] = methods.get(expr.method);
            const realArgs = [tObj].concat(tArgs);
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
      } else if (tObj.a.tag === "dict") {
        console.log("TC: dict method call");
        switch (expr.method) {
          case "pop":
            let numArgsPop = expr.arguments.length;
            if (numArgsPop > 2) {
              throw new TypeCheckError(
                `'dict' pop() expected at most 2 arguments, got ${numArgsPop}`
              );
            }
            let dictKeyTypePop = tObj.a.key;
            let tKeyPop = tcExpr(env, locals, expr.arguments[0]);
            if (!isAssignable(env, dictKeyTypePop, tKeyPop.a)) {
              throw new TypeCheckError(
                "Expected key type `" +
                  dictKeyTypePop.tag +
                  "`; got key lookup type `" +
                  tKeyPop.a.tag +
                  "`"
              );
            }
            return { ...expr, a: tObj.a.value, obj: tObj, arguments: [tKeyPop] };
          case "get":
            console.log("TC: get function in dict");
            let numArgsGet = expr.arguments.length;
            if (numArgsGet > 2) {
              throw new TypeCheckError(
                `'dict' get() expected at most 2 arguments, got ${numArgsGet}`
              );
            }
            let dictKeyTypeGet = tObj.a.key;
            let tKeyGet = tcExpr(env, locals, expr.arguments[0]);
            if (!isAssignable(env, dictKeyTypeGet, tKeyGet.a)) {
              throw new TypeCheckError(
                "Expected key type `" +
                  dictKeyTypeGet.tag +
                  "`; got key lookup type `" +
                  tKeyGet.a.tag +
                  "`"
              );
            }
            return { ...expr, a: tObj.a.value, obj: tObj, arguments: [tKeyGet] };
          case "update":
            console.log("TC: To-Do update function in dict");
            let numArgsUpdate = expr.arguments.length;
            if (numArgsUpdate > 2) {
              throw new TypeCheckError(
                `'dict' update() expected at most 1 argument, got ${numArgsUpdate}`
              );
            }
            let isArgDict = expr.arguments[0];
            if (isArgDict.tag === "literal") {
              throw new TypeCheckError(
                `'dict' update() expected an iterable, got ${isArgDict.value.tag}`
              );
            }
            let tUpdate = tcExpr(env, locals, isArgDict);
            return {
              ...expr,
              a: { tag: "none" },
              obj: tObj,
              arguments: [tUpdate],
            };
          case "clear":
            // throw error if there are any arguments in clear()
            let numArgsClear = expr.arguments.length;
            if (numArgsClear != 0) {
              throw new TypeCheckError(`'dict' clear() takes no arguments (${numArgsClear} given)`);
            }
            return {
              ...expr,
              a: { tag: "none" },
              obj: tObj,
              arguments: [{ tag: "literal", value: { tag: "none" } }]
            };
          default:
            throw new TypeCheckError(`'dict' object has no attribute '${expr.method}'`);
        }
      } else {
        throw new TypeCheckError("method calls require an object");
      }
      break;
    case "dict":
      let entries = expr.entries;
      let dictType: Type;
      // check for the empty dict, example: d = {} -> returns `none`
      if (!entries?.length) {
        dictType = { tag: "dict", key: { tag: "none" }, value: { tag: "none" } };
        let dictAnnotated = { ...expr, a: dictType, entries: entries };
        return dictAnnotated;
      } else {
        // the dict has one or more key-value pairs
        // return the types of keys and values, if they are consistent
        let keyTypes = new Set();
        let valueTypes = new Set();
        let entryTypes: Array<[Expr<Type>, Expr<Type>]> = [];
        for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
          let keyType = tcExpr(env, locals, entries[entryIndex][0]);
          let valueType = tcExpr(env, locals, entries[entryIndex][1]);
          entryTypes.push([keyType, valueType]);
          keyTypes.add(JSON.stringify(keyType.a));
          valueTypes.add(JSON.stringify(valueType.a));
        }
        if (keyTypes.size > 1) {
          throw new TypeCheckError("Heterogenous `Key` types aren't supported");
        }
        if (valueTypes.size > 1) {
          throw new TypeCheckError("Heterogenous `Value` types aren't supported");
        }
        let keyType = tcExpr(env, locals, entries[0][0]);
        let valueType = tcExpr(env, locals, entries[0][1]);
        dictType = { tag: "dict", key: keyType.a, value: valueType.a };
        let dictAnnotated = { ...expr, a: dictType, entries: entryTypes };
        return dictAnnotated;
      }
    case "list-expr":
      var commonType = null;
      const listExpr = expr.contents.map((content) => tcExpr(env, locals, content));
      if (listExpr.length == 0) {
        commonType = NONE;
      } else {
        commonType = listExpr[0].a;
        for (var i = 1; i < listExpr.length; ++i) {
          var lexprType = listExpr[i].a;
          if (!equalType(lexprType, commonType)) {
            if (equalType(commonType, NONE) && isNoneOrClass(lexprType)) {
              commonType = lexprType;
            } else if (!(equalType(lexprType, NONE) && isNoneOrClass(commonType))) {
              throw new TypeCheckError(
                `list expr type mismatch: ${lexprType}, expect type: ${commonType}`
              );
            }
          }
        }
      }
      return { ...expr, a: { tag: "list", content_type: commonType }, contents: listExpr };
    case "bracket-lookup":
      var tObj = tcExpr(env, locals, expr.obj);
      var tKey = tcExpr(env, locals, expr.key);
      if (tObj.a.tag === "dict") {
        var keyType = tObj.a.key;
        var valueType = tObj.a.value;
        var keyLookupType = tKey.a;
        if (!isAssignable(env, keyType, keyLookupType))
          throw new TypeCheckError(
            "Expected key type `" +
              keyType.tag +
              "`; got key lookup type `" +
              keyLookupType.tag +
              "`"
          );
        return { ...expr, a: valueType, obj: tObj, key: tKey };
      } else if (tObj.a.tag === "string") {
        //var obj_t = tcExpr(env, locals, expr.obj);
        //var key_t = tcExpr(env, locals, expr.key);
        var tBracketExpr = { ...expr, obj: tObj, key: tKey, a: tObj.a };
        if (tObj.a != STRING) {
          throw new TypeCheckError("Bracket lookup on " + tObj.a.tag + " type not possible");
        }
        if (tKey.a != NUM) {
          throw new TypeCheckError(
            "Bracket lookup using " + tKey.a.tag + " type as index is not possible"
          );
        }
        return tBracketExpr;
      } else if (tObj.a.tag === "list") {
        if (!equalType(tKey.a, NUM)) {
          throw new TypeCheckError("List lookup supports only integer indices");
        }
        return { ...expr, obj: tObj, key: tKey, a: tObj.a.content_type };
      } else {
        throw new TypeCheckError("Bracket lookup on " + tObj.a.tag + " type not possible");
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
    case "string":
      return STRING;
    default:
      unhandledTag(literal);
  }
}
