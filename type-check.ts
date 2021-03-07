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
import { transformComprehension } from "./transform";

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
  functions: Map<string, [Array<Parameter>, Type]>;
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
    functions: new Map(),
    topLevel: true,
    loop_depth: 0,
  };
}

function copyEnv(env: GlobalTypeEnv): GlobalTypeEnv {
  return {
    globals: new Map(env.globals),
    functions: new Map(env.functions),
    classes: new Map(env.classes),
  };
}

export type TypeError = {
  message: string;
};

export function equalType(t1: Type, t2: Type) {
  return (
    // ensure deep match for nested types (example: [int,[int,int]])
    JSON.stringify(t1) === JSON.stringify(t2) ||
    (t1.tag === "class" && t2.tag === "class" && t1.name === t2.name) ||
    //if dictionary is initialized to empty {}, then we check for "none" type in key and value
    (t1.tag === "dict" && t2.tag === "dict" && t1.key.tag === "none" && t1.value.tag === "none") ||
    (t1.tag === "callable" && t2.tag === "callable" && equalCallabale(t1, t2))
  );
}

export function equalCallabale(t1: Type, t2: Type): boolean {
  if (t1.tag === "callable" && t2.tag === "callable") {
    if (t1.args.length !== t2.args.length) {
      return false;
    }
    for (var i = 0; i < t1.args.length; i++) {
      if (!equalType(t1.args[i].type, t2.args[i].type)) {
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

const objtypes = ["class", "list", "dict", "callable"];
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
    newFuns.set(fun.name, [fun.parameters, fun.ret]);
    if (newGlobs.has(fun.name)) {
      throw new TypeCheckError(`Duplicate variable ${fun.name}`);
    }
    newGlobs.set(fun.name, {
      tag: "callable",
      args: fun.parameters,
      ret: fun.ret,
      isVar: false,
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
      methods.set(method.name, [method.parameters, method.ret]);
      if (fields.has(method.name)) {
        throw new TypeCheckError(`Duplicate variable ${method.name}`);
      }
      fields.set(method.name, {
        tag: "callable",
        args: method.parameters,
        ret: method.ret,
        isVar: false,
      });
    });
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
    locals.functions.set(func.name, [func.parameters, func.ret]);
    if (locals.vars.has(func.name)) {
      throw new TypeCheckError(`Duplicate variable ${func.name}`);
    }
    locals.vars.set(func.name, {
      tag: "callable",
      args: func.parameters,
      ret: func.ret,
      isVar: false,
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
    locals.functions.set(func.name, [func.parameters, func.ret]);
    if (locals.vars.has(func.name)) {
      throw new TypeCheckError(`Duplicate variable ${func.name}`);
    }
    locals.vars.set(func.name, {
      tag: "callable",
      args: func.parameters.map((p) => p),
      ret: func.ret,
      isVar: false,
    });
  });

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

export function tcLambda(locals: LocalTypeEnv, expr: Expr<null>, expected: Type) {
  if (expr.tag === "lambda" && expected.tag === "callable") {
    const args = expr.args;
    if (args.length === expected.args.length) {
      for (let i = 0; i < args.length; i++) {
        locals.vars.set(args[i], expected.args[i].type);
      }
    } else {
      throw new TypeError("Function call type mismatch: Lambda");
    }
  }
}

export function tcStmt(env: GlobalTypeEnv, locals: LocalTypeEnv, stmt: Stmt<null>): Stmt<Type> {
  switch (stmt.tag) {
    case "assignment":
      const tValueExpr = tcExpr(env, locals, stmt.value);
      return {
        a: NONE,
        tag: stmt.tag,
        value: tValueExpr,
        destruct: tcDestructure(env, locals, stmt.destruct, tValueExpr.a, stmt.value),
      };
    case "expr":
      const tExpr = tcExpr(env, locals, stmt.expr);
      return { a: tExpr.a, tag: stmt.tag, expr: tExpr };
    case "if":
      // loop_depth used for potential for loop breaks insiede this if
      locals.loop_depth += 1;
      var tCond = tcExpr(env, locals, stmt.cond);
      const tThn = tcBlock(env, locals, stmt.thn);
      const thnTyp = tThn[tThn.length - 1].a;
      const tEls = tcBlock(env, locals, stmt.els);
      const elsTyp = tEls[tEls.length - 1].a;
      // restore loop depth
      locals.loop_depth -= 1;
      if (tCond.a !== BOOL) throw new TypeCheckError("Condition Expression Must be a bool");
      else if (thnTyp !== elsTyp)
        throw new TypeCheckError("Types of then and else branches must match");
      return { a: thnTyp, tag: stmt.tag, cond: tCond, thn: tThn, els: tEls };
    case "return":
      if (locals.topLevel) throw new TypeCheckError("cannot return outside of functions");

      if (stmt.value.tag === "lambda" && locals.expectedRet.tag === "callable") {
        tcLambda(locals, stmt.value, locals.expectedRet);
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
      // record the history depth
      const wlast_depth = locals.loop_depth;
      // set depth information to 1 for potential break and continues
      locals.loop_depth = 1;
      var tCond = tcExpr(env, locals, stmt.cond);
      const tBody = tcBlock(env, locals, stmt.body);
      locals.loop_depth = wlast_depth;

      if (!equalType(tCond.a, BOOL))
        throw new TypeCheckError("Condition Expression Must be a bool");
      return { a: NONE, tag: stmt.tag, cond: tCond, body: tBody };
    case "pass":
      return { a: NONE, tag: stmt.tag };
    case "for":
      // check the type of iterator items, then add the item name into local variables with its type
      const fIter = tcExpr(env, locals, stmt.iterable);
      switch (fIter.a.tag) {
        case "class":
          if (fIter.a.name === "Range") {
            locals.vars.set(stmt.name, NUM);
            break;
          } else {
            throw new TypeCheckError(
              "for-loop cannot take " + fIter.a.name + " class as iterator."
            );
          }
        case "string":
          // Character not implemented
          // locals.vars.set(stmt.name, {tag: 'char'});
          throw new TypeCheckError("for-loop with strings are not implmented.");
        case "list":
          locals.vars.set(stmt.name, fIter.a.content_type);
          break;
        default:
          throw new TypeCheckError("Illegal iterating item in for-loop.");
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
        a: NONE,
        tag: "for",
        name: stmt.name,
        index: stmt.index,
        iterable: fIter,
        body: fBody,
      };
    case "continue":
      return { a: NONE, tag: "continue", depth: locals.loop_depth };
    case "break":
      if (locals.loop_depth < 1) {
        throw new TypeCheckError("Break outside a loop.");
      }
      return { a: NONE, tag: "break", depth: locals.loop_depth };
    case "field-assign":
      var tObj = tcExpr(env, locals, stmt.obj);
      const tVal = tcExpr(env, locals, stmt.value);
      if (tObj.a.tag !== "class") throw new TypeCheckError("field assignments require an object");
      if (!env.classes.has(tObj.a.name))
        throw new TypeCheckError("field assignment on an unknown class");
      const [fields, _] = env.classes.get(tObj.a.name);
      if (!fields.has(stmt.field))
        throw new TypeCheckError(`could not find field ${stmt.field} in class ${tObj.a.name}`);
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

/**
 * Type check a Destructure<null>. This requires explicitly passing in the type of the value this
 * assignment will receive.
 * @param env GlobalTypeEnv
 * @param locals LocalTypeEnv
 * @param destruct Destructure description of assign targets
 * @param value Type of the value passed into this destructure
 * @param expr Expr of the value passed into this destructure (only used for lambda expr)
 */
function tcDestructure(
  env: GlobalTypeEnv,
  locals: LocalTypeEnv,
  destruct: Destructure<null>,
  value: Type,
  expr: Expr<null>
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

    if (expr.tag === "lambda") {
      tcLambda(locals, expr, targetType);
      valueType = tcExpr(env, locals, expr).a;
    }

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
    // attrs.forEach((val) => types.push(val));
    attrs.forEach((val) => {
      if (val.tag === "callable" && val.isVar == false) return; // method should not count
      types.push(val);
    });
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
    case "lambda":
      throw new BaseException.TypeError("Lambda is not supported");
    /*
      var args: Type[] = [];
      expr.args.forEach((arg) => args.push(locals.vars.get(arg)));
      var callable: Type = { tag: "callable", args, ret: tcExpr(env, locals, expr.ret).a };
      return { ...expr, a: callable };
      */
    case "call_expr":
      if (expr.name.tag === "id" && env.classes.has(expr.name.name)) {
        // surprise surprise this is actually a constructor
        const tConstruct: Expr<Type> = {
          a: CLASS(expr.name.name),
          tag: "construct",
          name: expr.name.name,
        };
        const [_, methods] = env.classes.get(expr.name.name);
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
      }

      var innercall = tcExpr(env, locals, expr.name);
      if (innercall.a.tag === "callable") {
        const [args, ret] = [innercall.a.args, innercall.a.ret];
        const params = args;
        const retType = ret;
        const argTypes = args.map((p) => p.type);
        const tArgs = expr.arguments.map((arg) => tcExpr(env, locals, arg));

        if (
          args.length === expr.arguments.length &&
          tArgs.every((tArg, i) => isAssignable(env, tArg.a, argTypes[i]))
        ) {
          return { ...expr, a: retType, name: innercall, arguments: tArgs };
        }
        // case where the function may have default values
        else if (
          argTypes.length > expr.arguments.length &&
          tArgs.every((tArg, i) => tArg.a === argTypes[i])
        ) {
          // check if arguments less than number of parameters
          // first populate all the arguments first.
          // Then, populate the rest of the values with defaults from params
          var augArgs = tArgs;
          var argNums = tArgs.length;
          while (argNums < argTypes.length) {
            if (params[argNums].value === undefined) {
              throw new Error("Missing argument from call");
            } else {
              // add default values into arguments as an Expr
              augArgs = augArgs.concat([
                tcExpr(env, locals, { tag: "literal", value: params[argNums].value }),
              ]);
            }
            argNums = argNums + 1;
          }
          return { ...expr, a: ret, name: innercall, arguments: augArgs };
        } else {
          throw new TypeError("Function call type mismatch: " + expr.name);
        }
      } else {
        throw new TypeError("Undefined function: " + expr.name);
      }
    case "call":
      throw new TypeError("Parser should use call_expr instead whose callee is an expression.");
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

          var methodArgs: Type[];
          var methodRet: Type;
          if (fields.has(expr.method)) {
            var temp = fields.get(expr.method);
            // should always be true
            if (temp.tag === "callable") {
              [methodArgs, methodRet] = [temp.args.map((p) => p.type), temp.ret];
            }

            var realArgs: Expr<Type>[] = tArgs;
            if (methods.has(expr.method)) {
              realArgs = [tObj].concat(tArgs);
            }
            console.log(methodArgs);
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
    case "comprehension":
      /*
       * Since this is implemented before lists/iterators, we are making a mockup version.
       * See milestone doc for details.
       * The mockups will be replaced next week by the commented code.
       */

      // iter
      const iter = tcExpr(env, locals, expr.iter);
      if (iter.a.tag !== "class" || iter.a.name !== "Range") {
        throw new TypeCheckError("Only mockup Range is supported for now");
      }

      // if (iter.a.tag !== 'list') { // TODO: add check for iterator type
      //   throw new TypeCheckError(`${iter.a.tag} object is not iterable`);
      // }

      // field
      const newEnv = copyEnv(env);
      if (expr.field.tag === "id") {
        newEnv.globals.set(expr.field.name, NUM);
        // newEnv.globals.set(expr.field.name, iter.a.content_type);
      } else {
        //* Right now, we don't know if we (or the for loop team) will support this special case.
        // Need to check if the field exists in the object, and whether it is a number.
        if (tcExpr(env, locals, expr.field).a.tag !== "number") {
          throw new TypeCheckError("only numbers are supported for now");
        }
      }

      // expr
      const newExpr = tcExpr(newEnv, locals, expr.expr);
      if (newExpr.a.tag !== "number") {
        throw new TypeCheckError("only numbers are supported for now");
      }

      //const typ: Type = {tag: "list", content_type: newExpr.a}

      // cond
      //*Notice that in regular Python, cond can be of any type. We make this restriction here to make life easier :)
      if (expr.cond) {
        const cond = tcExpr(newEnv, locals, expr.cond);

        if (cond.a.tag !== "bool") {
          throw new TypeCheckError("condition must be boolean");
        }

        return transformComprehension({
          a: { tag: "class", name: "Range" },
          tag: "comprehension",
          expr: newExpr,
          field: expr.field,
          iter,
          cond,
        });
      }

      return transformComprehension({
        a: { tag: "class", name: "Range" },
        tag: "comprehension",
        expr: newExpr,
        field: expr.field,
        iter,
      });

    // return {
    //   a: { tag: "list", content_type: newExpr.a },
    //   tag: "comprehension",
    //   expr: newExpr,
    //   field: expr.field,
    //   iter,
    //   cond,
    // };

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
    case "dict":
      let entries = expr.entries;
      let dictType: Type;
      // check for the empty dict, example: d = {} -> returns `none`
      if (!(entries.length > 0)) {
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
    case "bracket-lookup":
      var obj_t = tcExpr(env, locals, expr.obj);
      var key_t = tcExpr(env, locals, expr.key);
      if (obj_t.a.tag === "dict") {
        let keyType = obj_t.a.key;
        let valueType = obj_t.a.value;
        let keyLookupType = key_t.a;
        if (!isAssignable(env, keyType, keyLookupType))
          throw new TypeCheckError(
            "Expected key type `" +
              keyType.tag +
              "`; got key lookup type `" +
              keyLookupType.tag +
              "`"
          );
        return { ...expr, a: valueType, obj: obj_t, key: key_t };
      } else if (obj_t.a.tag == "string") {
        if (!equalType(key_t.a, NUM)) {
          throw new TypeCheckError("String lookup supports only integer indices");
        }
        return { ...expr, obj: obj_t, key: key_t, a: obj_t.a };
      } else if (obj_t.a.tag === "list") {
        if (!equalType(key_t.a, NUM)) {
          throw new TypeCheckError("List lookup supports only integer indices");
        }
        return { ...expr, obj: obj_t, key: key_t, a: obj_t.a.content_type };
      } else {
        throw new TypeCheckError("Bracket lookup on " + obj_t.a.tag + " type not possible");
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
