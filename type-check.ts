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
  Location,
  Destructure,
  Assignable,
  ASSIGNABLE_TAGS,
  AssignTarget,
  Parameter,
} from "./ast";
import { NUM, STRING, BOOL, NONE, CLASS, unhandledTag, unreachable, isTagged } from "./utils";
import * as BaseException from "./error";
import { at } from "cypress/types/lodash";

export type GlobalTypeEnv = {
  globals: Map<string, Type>;
  functions: Map<string, [Array<Parameter>, Type]>;
  classes: Map<string, [Map<string, Type>, Map<string, [Array<Type>, Type]>]>;
};

export type LocalTypeEnv = {
  vars: Map<string, Type>;
  expectedRet: Type;
  topLevel: boolean;
  loop_depth: number;
};

const defaultGlobalFunctions = new Map();
defaultGlobalFunctions.set("abs", [[{ type: NUM }], NUM]);
defaultGlobalFunctions.set("max", [[{ type: NUM }, { type: NUM }], NUM]);
defaultGlobalFunctions.set("min", [[{ type: NUM }, { type: NUM }], NUM]);
defaultGlobalFunctions.set("pow", [[{ type: NUM }, { type: NUM }], NUM]);
defaultGlobalFunctions.set("print", [[CLASS("object")], NUM]);
defaultGlobalFunctions.set("range", [[NUM], CLASS("Range")]);

const defaultGlobalClasses = new Map();
// Range initialization
const dfields = new Map();
dfields.set("cur", NUM);
dfields.set("stop", NUM);
dfields.set("step", NUM);
defaultGlobalClasses.set("Range", [dfields, new Map()]);

export const defaultTypeEnv = {
  globals: new Map(),
  functions: defaultGlobalFunctions,
  classes: defaultGlobalClasses,
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
    loop_depth: 0,
  };
}

export function equalType(t1: Type, t2: Type): boolean {
  return (
    // ensure deep match for nested types (example: [int,[int,int]])
    JSON.stringify(t1) === JSON.stringify(t2) ||
    (t1.tag === "class" && t2.tag === "class" && t1.name === t2.name) ||
    //if dictionary is initialized to empty {}, then we check for "none" type in key and value
    (t1.tag === "dict" && t2.tag === "dict" && t1.key.tag === "none" && t1.value.tag === "none")
  );
}

export function isNoneOrClass(t: Type) {
  return t.tag === "none" || t.tag === "class";
}

const objtypes = ["class", "list", "dict"];
function isObjectTypeTag(t: string): boolean {
  return objtypes.indexOf(t) >= 0;
}
export function isSubtype(env: GlobalTypeEnv, t1: Type, t2: Type): boolean {
  return equalType(t1, t2) || (t1.tag === "none" && isObjectTypeTag(t2.tag));
}

export function isAssignable(env: GlobalTypeEnv, t1: Type, t2: Type): boolean {
  return isSubtype(env, t1, t2);
}

export function join(env: GlobalTypeEnv, t1: Type, t2: Type): Type {
  return NONE;
}

export function augmentTEnv(env: GlobalTypeEnv, program: Program<Location>): GlobalTypeEnv {
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
    cls.methods.forEach((method) =>
      methods.set(method.name, [method.parameters.map((p) => p.type), method.ret])
    );
    newClasses.set(cls.name, [fields, methods]);
  });
  return { globals: newGlobs, functions: newFuns, classes: newClasses };
}

export function tc(
  env: GlobalTypeEnv,
  program: Program<Location>
): [Program<[Type, Location]>, GlobalTypeEnv] {
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
    lastTyp = tBody[tBody.length - 1].a[0];
  }
  // TODO(joe): check for assignment in existing env vs. new declaration
  // and look for assignment consistency
  for (let name of locals.vars.keys()) {
    newEnv.globals.set(name, locals.vars.get(name));
  }
  const aprogram: Program<[Type, Location]> = {
    a: [lastTyp, program.a],
    inits: tInits,
    funs: tDefs,
    classes: tClasses,
    stmts: tBody,
  };
  return [aprogram, newEnv];
}

export function tcInit(env: GlobalTypeEnv, init: VarInit<Location>): VarInit<[Type, Location]> {
  const valTyp = tcLiteral(init.value);
  if (isAssignable(env, valTyp, init.type)) {
    return { ...init, a: [NONE, init.a] };
  } else {
    // Some type mismatch is allowed in python, so we use customized TypeMismatchError here, which does not exist in real python.
    throw new BaseException.TypeMismatchError(init.a, init.type, valTyp);
  }
}

export function tcDef(env: GlobalTypeEnv, fun: FunDef<Location>): FunDef<[Type, Location]> {
  var locals = emptyLocalTypeEnv();
  locals.expectedRet = fun.ret;
  locals.topLevel = false;
  // type checking defaults
  fun.parameters.forEach((p) => tcDefault(p.type, p.value));
  fun.parameters.forEach((p) => locals.vars.set(p.name, p.type));
  fun.inits.forEach((init) => locals.vars.set(init.name, tcInit(env, init).type));

  const tBody = tcBlock(env, locals, fun.body);
  return {
    ...fun,
    a: [NONE, fun.a],
    body: tBody,
    decls: fun.decls.map((s) => {
      return { ...s, a: [undefined, s.a] };
    }), // TODO
    inits: fun.inits.map((s) => tcInit(env, s)),
    funs: fun.funs.map((s) => tcDef(env, s)),
  };
}

export function tcDefault(paramType: Type, paramLiteral: Literal) {
  // no default values
  if (paramLiteral === undefined) {
    return;
  } else if (paramLiteral.tag === "num" && paramType.tag === "number") {
    return;
  } else if (paramLiteral.tag !== paramType.tag) {
    throw new BaseException.CompileError(
      undefined, // TODO
      "Default value type " + paramLiteral.tag + " does not match param type " + paramType.tag
    );
  }
}

export function tcClass(env: GlobalTypeEnv, cls: Class<Location>): Class<[Type, Location]> {
  const tFields = cls.fields.map((field) => tcInit(env, field));
  const tMethods = cls.methods.map((method) => tcDef(env, method));
  return { a: [NONE, cls.a], name: cls.name, fields: tFields, methods: tMethods };
}

export function tcBlock(
  env: GlobalTypeEnv,
  locals: LocalTypeEnv,
  stmts: Array<Stmt<Location>>
): Array<Stmt<[Type, Location]>> {
  return stmts.map((stmt) => tcStmt(env, locals, stmt));
}

export function tcStmt(
  env: GlobalTypeEnv,
  locals: LocalTypeEnv,
  stmt: Stmt<Location>
): Stmt<[Type, Location]> {
  switch (stmt.tag) {
    case "assignment":
      const tValueExpr = tcExpr(env, locals, stmt.value);
      return {
        a: [NONE, stmt.a],
        tag: stmt.tag,
        value: tValueExpr,
        destruct: tcDestructure(env, locals, stmt.destruct, tValueExpr.a[0]),
      };
    case "expr":
      const tExpr = tcExpr(env, locals, stmt.expr);
      return { a: tExpr.a, tag: stmt.tag, expr: tExpr };
    case "if":
      // loop_depth used for potential for loop breaks insiede this if
      locals.loop_depth += 1;
      var tCond = tcExpr(env, locals, stmt.cond);
      const tThn = tcBlock(env, locals, stmt.thn);
      const thnTyp = tThn[tThn.length - 1].a[0];
      const tEls = tcBlock(env, locals, stmt.els);
      const elsTyp = tEls[tEls.length - 1].a[0];
      // restore loop depth
      locals.loop_depth -= 1;
      if (tCond.a[0] !== BOOL) throw new BaseException.ConditionTypeError(tCond.a[1], tCond.a[0]);
      else if (thnTyp !== elsTyp)
        throw new BaseException.SyntaxError(stmt.a, "Types of then and else branches must match");
      return { a: [thnTyp, stmt.a], tag: stmt.tag, cond: tCond, thn: tThn, els: tEls };
    case "return":
      if (locals.topLevel)
        throw new BaseException.SyntaxError(stmt.a, "‘return’ outside of functions");
      const tRet = tcExpr(env, locals, stmt.value);
      if (!isAssignable(env, tRet.a[0], locals.expectedRet))
        throw new BaseException.TypeMismatchError(stmt.a, locals.expectedRet, tRet.a[0]);
      return { a: tRet.a, tag: stmt.tag, value: tRet };
    case "while":
      // record the history depth
      const wlast_depth = locals.loop_depth;
      // set depth information to 1 for potential break and continues
      locals.loop_depth = 1;
      var tCond = tcExpr(env, locals, stmt.cond);
      const tBody = tcBlock(env, locals, stmt.body);
      locals.loop_depth = wlast_depth;

      if (!equalType(tCond.a[0], BOOL))
        throw new BaseException.ConditionTypeError(tCond.a[1], tCond.a[0]);
      return { a: [NONE, stmt.a], tag: stmt.tag, cond: tCond, body: tBody };
    case "pass":
      return { a: [NONE, stmt.a], tag: stmt.tag };
    case "for":
      // check the type of iterator items, then add the item name into local variables with its type
      const fIter = tcExpr(env, locals, stmt.iterable);
      switch (fIter.a[0].tag) {
        case "class":
          if (fIter.a[0].name === "Range") {
            locals.vars.set(stmt.name, NUM);
            break;
          } else {
            throw new BaseException.CompileError(
              stmt.a,
              "for-loop cannot take " + fIter.a[0].name + " class as iterator."
            );
          }
        case "string":
          // Character not implemented
          // locals.vars.set(stmt.name, {tag: 'char'});
          throw new BaseException.CompileError(stmt.a, "for-loop with strings are not implmented.");
        case "list":
          locals.vars.set(stmt.name, fIter.a[0].content_type);
          break;
        default:
          throw new BaseException.CompileError(stmt.a, "Illegal iterating item in for-loop.");
      }
      // record the history depth
      const last_depth = locals.loop_depth;
      // set depth information to 1 for potential break and continues
      locals.loop_depth = 1;
      // go into body
      const fBody = tcBlock(env, locals, stmt.body);
      // delete the temp var information after finished the body, and restore last depth
      // locals.vars.delete(stmt.name);
      locals.loop_depth = last_depth;

      // return type checked stmt
      return {
        a: [NONE, stmt.a],
        tag: "for",
        name: stmt.name,
        index: stmt.index,
        iterable: fIter,
        body: fBody,
      };
    case "continue":
      return { a: [NONE, stmt.a], tag: "continue", depth: locals.loop_depth };
    case "break":
      if (locals.loop_depth < 1) {
        throw new BaseException.SyntaxError(stmt.a, "Break outside a loop.");
      }
      return { a: [NONE, stmt.a], tag: "break", depth: locals.loop_depth };
    case "field-assign":
      var tObj = tcExpr(env, locals, stmt.obj);
      const tVal = tcExpr(env, locals, stmt.value);
      if (tObj.a[0].tag !== "class")
        throw new BaseException.CompileError(stmt.a, "field assignments require an object");
      if (!env.classes.has(tObj.a[0].name))
        throw new BaseException.CompileError(stmt.a, "field assignment on an unknown class");
      const [fields, _] = env.classes.get(tObj.a[0].name);
      if (!fields.has(stmt.field))
        throw new BaseException.CompileError(
          stmt.a,
          `could not find field ${stmt.field} in class ${tObj.a[0].name}`
        );
      if (!isAssignable(env, tVal.a[0], fields.get(stmt.field)))
        // throw new BaseException.TypeMismatchError(stmt.a, fields.get(stmt.field) , tVal.a);
        throw new BaseException.CompileError(
          stmt.a,
          `could not assign value of type: ${tVal.a}; field ${
            stmt.field
          } expected type: ${fields.get(stmt.field)}`
        );
      return { ...stmt, a: [NONE, stmt.a], obj: tObj, value: tVal };
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
  destruct: Destructure<Location>,
  value: Type
): Destructure<[Type, Location]> {
  /**
   * Type check an AssignTarget<null>. Ensures that the target is valid and that its type is compatible with the
   * value being assignment
   * @param {AssignTarget<null>} aTarget - The target to be type checked
   * @param {Type} valueType - The type of the value being assigned to the target
   */
  function tcTarget(
    aTarget: AssignTarget<Location>,
    valueType: Type
  ): AssignTarget<[Type, Location]> {
    let { target, starred, ignore } = aTarget;
    const tTarget = tcAssignable(env, locals, target);
    const targetType = tTarget.a;
    if (!isAssignable(env, valueType, targetType[0]))
      throw new BaseException.TypeMismatchError(aTarget.target.a, valueType, targetType[0]);
    return {
      starred,
      ignore,
      target: tTarget,
    };
  }

  if (!destruct.isDestructured) {
    let target = tcTarget(destruct.targets[0], value);
    return {
      valueType: [value, destruct.valueType],
      isDestructured: false,
      targets: [target],
    };
  }

  let types: Type[] = [];
  if (value.tag === "class") {
    // This is a temporary hack to get destructuring working (reuse for tuples later?)
    let cls = env.classes.get(value.name);
    if (cls === undefined)
      throw new BaseException.InternalException(
        `Class ${value.name} not found in global environment. This is probably a parsing bug.`
      );
    let attrs = cls[0];
    attrs.forEach((val) => types.push(val));
    let starOffset = 0;
    let tTargets: AssignTarget<[Type, Location]>[] = destruct.targets.map((target, i, targets) => {
      if (i >= types.length)
        throw new BaseException.ValueError(
          `Not enough values to unpack (expected at least ${i}, got ${types.length})`
        );
      if (target.starred) {
        starOffset = types.length - targets.length; // How many values will be assigned to the starred target
        throw new BaseException.CompileError(destruct.valueType, "Starred values not supported");
      }
      let valueType = types[i + starOffset];
      return tcTarget(target, valueType);
    });

    if (types.length > destruct.targets.length + starOffset)
      throw new BaseException.ValueError(
        `Too many values to unpack (expected ${destruct.targets.length}, got ${types.length})`
      );

    return {
      isDestructured: destruct.isDestructured,
      targets: tTargets,
      valueType: [value, destruct.valueType],
    };
  } else {
    throw new BaseException.CompileError(
      destruct.valueType,
      `Type ${value.tag} cannot be destructured`
    );
  }
}

function tcAssignable(
  env: GlobalTypeEnv,
  locals: LocalTypeEnv,
  target: Assignable<Location>
): Assignable<[Type, Location]> {
  const expr = tcExpr(env, locals, target);
  if (!isTagged(expr, ASSIGNABLE_TAGS)) {
    throw new BaseException.CompileError(target.a, `Cannot assing to target type ${expr.tag}`);
  }
  return expr;
}

export function tcExpr(
  env: GlobalTypeEnv,
  locals: LocalTypeEnv,
  expr: Expr<Location>
): Expr<[Type, Location]> {
  switch (expr.tag) {
    case "literal":
      return { ...expr, a: [tcLiteral(expr.value), expr.a] };
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
          if (
            expr.op == BinOp.Plus &&
            tLeft.a[0].tag === "list" &&
            equalType(tLeft.a[0], tRight.a[0])
          ) {
            return { ...tBin, a: [tLeft.a[0], expr.a] };
          }
          if (equalType(tLeft.a[0], NUM) && equalType(tRight.a[0], NUM)) {
            return { ...tBin, a: [NUM, expr.a] };
          } else {
            throw new BaseException.UnsupportedOperandTypeError(expr.a, expr.op, [
              tLeft.a[0],
              tRight.a[0],
            ]);
          }
        case BinOp.Eq:
        case BinOp.Neq:
          if (equalType(tLeft.a[0], tRight.a[0])) {
            return { ...tBin, a: [BOOL, expr.a] };
          } else {
            throw new BaseException.UnsupportedOperandTypeError(expr.a, expr.op, [
              tLeft.a[0],
              tRight.a[0],
            ]);
          }
        case BinOp.Lte:
        case BinOp.Gte:
        case BinOp.Lt:
        case BinOp.Gt:
          if (equalType(tLeft.a[0], NUM) && equalType(tRight.a[0], NUM)) {
            return { ...tBin, a: [BOOL, expr.a] };
          } else {
            throw new BaseException.UnsupportedOperandTypeError(expr.a, expr.op, [
              tLeft.a[0],
              tRight.a[0],
            ]);
          }
        case BinOp.And:
        case BinOp.Or:
          if (equalType(tLeft.a[0], BOOL) && equalType(tRight.a[0], BOOL)) {
            return { ...tBin, a: [BOOL, expr.a] };
          } else {
            throw new BaseException.UnsupportedOperandTypeError(expr.a, expr.op, [
              tLeft.a[0],
              tRight.a[0],
            ]);
          }
        case BinOp.Is:
          if (!isNoneOrClass(tLeft.a[0]) || !isNoneOrClass(tRight.a[0]))
            throw new BaseException.UnsupportedOperandTypeError(expr.a, expr.op, [
              tLeft.a[0],
              tRight.a[0],
            ]);
          return { ...tBin, a: [BOOL, expr.a] };
        default:
          return unreachable(expr);
      }
    case "uniop":
      const tExpr = tcExpr(env, locals, expr.expr);
      const tUni = { ...expr, a: tExpr.a, expr: tExpr };
      switch (expr.op) {
        case UniOp.Neg:
          if (equalType(tExpr.a[0], NUM)) {
            return tUni;
          } else {
            throw new BaseException.UnsupportedOperandTypeError(expr.a, expr.op, [tExpr.a[0]]);
          }
        case UniOp.Not:
          if (equalType(tExpr.a[0], BOOL)) {
            return tUni;
          } else {
            throw new BaseException.UnsupportedOperandTypeError(expr.a, expr.op, [tExpr.a[0]]);
          }
        default:
          return unreachable(expr);
      }
    case "id":
      if (locals.vars.has(expr.name)) {
        return { ...expr, a: [locals.vars.get(expr.name), expr.a] };
      } else if (env.globals.has(expr.name)) {
        return { ...expr, a: [env.globals.get(expr.name), expr.a] };
      } else {
        throw new BaseException.NameError(expr.a, expr.name);
      }
    case "builtin1":
      if (expr.name === "print") {
        const tArg = tcExpr(env, locals, expr.arg);
        return { ...expr, a: tArg.a, arg: tArg };
      } else if (env.functions.has(expr.name)) {
        const [[expectedParam], retTyp] = env.functions.get(expr.name);
        const tArg = tcExpr(env, locals, expr.arg);

        if (isAssignable(env, tArg.a[0], expectedParam.type)) {
          return { ...expr, a: [retTyp, expr.a], arg: tArg };
        } else {
          throw new BaseException.TypeMismatchError(expr.a, expectedParam.type, tArg.a[0]);
        }
      } else {
        throw new BaseException.NameError(expr.a, expr.name);
      }
    case "builtin2":
      if (env.functions.has(expr.name)) {
        const [[leftParam, rightParam], retTyp] = env.functions.get(expr.name);
        const tLeftArg = tcExpr(env, locals, expr.left);
        const tRightArg = tcExpr(env, locals, expr.right);
        if (
          isAssignable(env, leftParam.type, tLeftArg.a[0]) &&
          isAssignable(env, rightParam.type, tRightArg.a[0])
        ) {
          return { ...expr, a: [retTyp, expr.a], left: tLeftArg, right: tRightArg };
        } else {
          throw new BaseException.TypeMismatchError(
            expr.a,
            [leftParam.type, rightParam.type],
            [tLeftArg.a[0], tRightArg.a[0]]
          );
        }
      } else {
        throw new BaseException.NameError(expr.a, expr.name);
      }
    case "call":
      if (env.classes.has(expr.name)) {
        // surprise surprise this is actually a constructor
        const tConstruct: Expr<[Type, Location]> = {
          a: [CLASS(expr.name), expr.a],
          tag: "construct",
          name: expr.name,
        };
        const [_, methods] = env.classes.get(expr.name);
        if (methods.has("__init__")) {
          const [initArgs, initRet] = methods.get("__init__");
          if (expr.arguments.length !== initArgs.length - 1) {
            throw new BaseException.TypeError(
              expr.a,
              `__init__() takes ${initArgs.length} positional arguments but ${
                expr.arguments.length + 1
              } were given`
            );
          }
          if (initRet !== NONE) {
            throw new BaseException.TypeError(
              expr.a,
              `__init__() should return None, not '${
                initRet.tag == "class" ? initRet.name : initRet.tag
              }'`
            );
          }
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
          tArgs.every((tArg, i) => tArg.a[0] === argTypes[i])
        ) {
          return { ...expr, a: [retType, expr.a], arguments: tArgs };
        }
        // case where the function may have default values
        else if (
          argTypes.length > expr.arguments.length &&
          tArgs.every((tArg, i) => tArg.a[0] === argTypes[i])
        ) {
          // check if arguments less than number of parameters
          // first populate all the arguments first.
          // Then, populate the rest of the values with defaults from params
          var augArgs = tArgs;
          var argNums = expr.arguments.length;
          while (argNums < argTypes.length) {
            if (params[argNums].value === undefined) {
              throw new BaseException.CompileError(expr.a, "Missing argument from call");
            } else {
              // add default values into arguments as an Expr
              // TODO : fill in the [Type, Location] for this literal in the following loc
              // Example : fun(x : int, y : int = 1)
              // augArgs = [{a: [INT, Location], ...}, {literal "1"}]
              augArgs = augArgs.concat({
                tag: "literal",
                value: params[argNums].value,
                a: undefined /* fill in here */,
              });
            }
            argNums = argNums + 1;
          }
          return { ...expr, a: [retType, expr.a], arguments: augArgs };
        } else {
          throw new BaseException.TypeMismatchError(
            expr.a,
            argTypes,
            tArgs.map((s) => {
              return s.a[0];
            })
          );
        }
      } else {
        throw new BaseException.NameError(expr.a, expr.name);
      }
    case "lookup":
      var tObj = tcExpr(env, locals, expr.obj);
      if (tObj.a[0].tag === "class") {
        if (env.classes.has(tObj.a[0].name)) {
          const [fields, _] = env.classes.get(tObj.a[0].name);
          if (fields.has(expr.field)) {
            return { ...expr, a: [fields.get(expr.field), expr.a], obj: tObj };
          } else {
            throw new BaseException.AttributeError(expr.a, tObj.a[0], expr.field);
          }
        } else {
          throw new BaseException.NameError(expr.a, tObj.a[0].name);
        }
      } else {
        throw new BaseException.AttributeError(expr.a, tObj.a[0], expr.field);
      }
    case "method-call":
      var tObj = tcExpr(env, locals, expr.obj);
      var tArgs = expr.arguments.map((arg) => tcExpr(env, locals, arg));
      if (tObj.a[0].tag === "class") {
        if (env.classes.has(tObj.a[0].name)) {
          const [_, methods] = env.classes.get(tObj.a[0].name);
          if (methods.has(expr.method)) {
            const [methodArgs, methodRet] = methods.get(expr.method);
            const realArgs = [tObj].concat(tArgs);
            if (
              methodArgs.length === realArgs.length &&
              methodArgs.every((argTyp, i) => isAssignable(env, realArgs[i].a[0], argTyp))
            ) {
              return { ...expr, a: [methodRet, expr.a], obj: tObj, arguments: tArgs };
            } else if (methodArgs.length != realArgs.length) {
              throw new BaseException.TypeError(
                expr.a,
                `${expr.method} takes ${methodArgs.length} positional arguments but ${realArgs.length} were given`
              );
            } else {
              throw new BaseException.TypeMismatchError(
                expr.a,
                methodArgs,
                realArgs.map((s) => {
                  return s.a[0];
                })
              );
            }
          } else {
            throw new BaseException.AttributeError(expr.a, tObj.a[0], expr.method);
          }
        } else {
          throw new BaseException.NameError(expr.a, tObj.a[0].name);
        }
      } else {
        throw new BaseException.AttributeError(expr.a, tObj.a[0], expr.method);
      }
    case "list-expr":
      var commonType = null;
      const listExpr = expr.contents.map((content) => tcExpr(env, locals, content));
      if (listExpr.length == 0) {
        commonType = NONE;
      } else {
        commonType = listExpr[0].a[0];
        for (var i = 1; i < listExpr.length; ++i) {
          var lexprType = listExpr[i].a[0];
          if (!equalType(lexprType, commonType)) {
            if (equalType(commonType, NONE) && isNoneOrClass(lexprType)) {
              commonType = lexprType;
            } else if (!(equalType(lexprType, NONE) && isNoneOrClass(commonType))) {
              throw new BaseException.TypeMismatchError(expr.a, commonType, lexprType);
            }
          }
        }
      }
      return {
        ...expr,
        a: [{ tag: "list", content_type: commonType }, expr.a],
        contents: listExpr,
      };
    case "dict":
      let entries = expr.entries;
      let dictType: Type;
      // check for the empty dict, example: d = {} -> returns `none`
      if (!(entries.length > 0)) {
        dictType = { tag: "dict", key: { tag: "none" }, value: { tag: "none" } };
        return {
          ...expr,
          a: [dictType, expr.a],
          entries: expr.entries.map((s) => {
            return [tcExpr(env, locals, s[0]), tcExpr(env, locals, s[1])];
          }),
        };
      } else {
        // the dict has one or more key-value pairs
        // return the types of keys and values, if they are consistent
        let keyTypes = new Set();
        let valueTypes = new Set();
        let entryTypes: Array<[Expr<[Type, Location]>, Expr<[Type, Location]>]> = [];
        for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
          let keyType = tcExpr(env, locals, entries[entryIndex][0]);
          let valueType = tcExpr(env, locals, entries[entryIndex][1]);
          entryTypes.push([keyType, valueType]);
          keyTypes.add(JSON.stringify(keyType.a[0]));
          valueTypes.add(JSON.stringify(valueType.a[0]));
        }
        if (keyTypes.size > 1) {
          throw new BaseException.CompileError(expr.a, "Heterogenous `Key` types aren't supported");
        }
        if (valueTypes.size > 1) {
          throw new BaseException.CompileError(
            expr.a,
            "Heterogenous `Value` types aren't supported"
          );
        }
        let keyType = tcExpr(env, locals, entries[0][0]);
        let valueType = tcExpr(env, locals, entries[0][1]);
        dictType = { tag: "dict", key: keyType.a[0], value: valueType.a[0] };
        return { ...expr, a: [dictType, expr.a], entries: entryTypes };
      }
    case "bracket-lookup":
      var obj_t = tcExpr(env, locals, expr.obj);
      var key_t = tcExpr(env, locals, expr.key);
      if (obj_t.a[0].tag === "dict") {
        let keyType = obj_t.a[0].key;
        let valueType = obj_t.a[0].value;
        let keyLookupType = key_t.a[0];
        if (!isAssignable(env, keyType, keyLookupType))
          throw new BaseException.TypeMismatchError(expr.a, keyType, keyLookupType);
        return { ...expr, a: [valueType, expr.a], obj: obj_t, key: key_t };
      } else if (obj_t.a[0].tag == "string") {
        if (!equalType(key_t.a[0], NUM)) {
          throw new BaseException.CompileError(
            expr.a,
            "String lookup supports only integer indices"
          );
        }
        return { ...expr, obj: obj_t, key: key_t, a: obj_t.a };
      } else if (obj_t.a[0].tag === "list") {
        if (!equalType(key_t.a[0], NUM)) {
          throw new BaseException.CompileError(expr.a, "List lookup supports only integer indices");
        }
        return { ...expr, obj: obj_t, key: key_t, a: [obj_t.a[0].content_type, expr.a] };
      } else {
        throw new BaseException.CompileError(
          expr.a,
          "Bracket lookup on " + obj_t.a[0].tag + " type not possible"
        );
      }

    default:
      throw new BaseException.CompileError(expr.a, `unimplemented type checking for expr: ${expr}`);
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

export function toObject(types: Type[]): string {
  return `[${types
    .map((s) => {
      return s.tag === "class" ? s.name : s.tag;
    })
    .join(",")}]`;
}
