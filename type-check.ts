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

export function equalType(t1: Type, t2: Type): boolean {
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

export function augmentTEnv(env: GlobalTypeEnv, program: Program<Location>): GlobalTypeEnv {
  const newGlobs = new Map(env.globals);
  const newFuns = new Map(env.functions);
  const newClasses = new Map(env.classes);
  program.inits.forEach((init) => {
    if (newGlobs.has(init.name)) {
      throw new BaseException.CompileError(init.a, `Duplicate variable ${init.name}`);
    }
    newGlobs.set(init.name, init.type);
  });
  program.funs.forEach((fun) => {
    newFuns.set(fun.name, [fun.parameters, fun.ret]);
    if (newGlobs.has(fun.name)) {
      throw new BaseException.CompileError(fun.a, `Duplicate variable ${fun.name}`);
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
        throw new BaseException.CompileError(field.a, `Duplicate variable ${field.name}`);
      }
      fields.set(field.name, field.type);
    });
    cls.methods.forEach((method) => {
      methods.set(method.name, [method.parameters, method.ret]);
      if (fields.has(method.name)) {
        throw new BaseException.CompileError(method.a, `Duplicate variable ${method.name}`);
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

export function tc(
  env: GlobalTypeEnv,
  program: Program<Location>
): [Program<[Type, Location]>, GlobalTypeEnv] {
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
    closures: [],
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

  fun.parameters.forEach((p) => {
    if (locals.vars.has(p.name)) {
      throw new BaseException.CompileError(fun.a, `Duplicate variable ${p.name}`);
    }
    locals.vars.set(p.name, p.type);
  });
  fun.inits.forEach((init) => {
    if (locals.vars.has(init.name)) {
      throw new BaseException.CompileError(init.a, `Duplicate variable ${init.name}`);
    }
    locals.vars.set(init.name, tcInit(env, init).type);
  });
  fun.decls.forEach((decl) => {
    if (decl.tag == "nonlocal") {
      throw new BaseException.CompileError(fun.a, `Invalid Nonlocal Variable ${decl.name}`);
    }
    if (!env.globals.has(decl.name)) {
      throw new BaseException.CompileError(fun.a, `Invalid global Variable ${decl.name}`);
    }
    throw new Error(`Invalid global Variable ${decl.name}`);
  });
  fun.funs.forEach((func) => {
    locals.functions.set(func.name, [func.parameters, func.ret]);
    if (locals.vars.has(func.name)) {
      throw new BaseException.CompileError(func.a, `Duplicate variable ${func.name}`);
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
  return {
    ...fun,
    a: [NONE, fun.a],
    body: tBody,
    decls: fun.decls.map((s) => {
      return { ...s, a: [undefined, s.a] };
    }), // TODO
    inits: fun.inits.map((s) => tcInit(env, s)),
    funs: tDefs,
  };
}

export function tcNestDef(
  env: GlobalTypeEnv,
  nestEnv: LocalTypeEnv,
  fun: FunDef<Location>
): FunDef<[Type, Location]> {
  var locals = emptyLocalTypeEnv();
  locals.expectedRet = fun.ret;
  locals.topLevel = false;

  fun.parameters.forEach((p) => {
    if (locals.vars.has(p.name)) {
      throw new BaseException.CompileError(fun.a, `Duplicate variable ${p.name}`);
    }
    locals.vars.set(p.name, p.type);
  });
  fun.inits.forEach((init) => {
    if (locals.vars.has(init.name)) {
      throw new BaseException.CompileError(init.a, `Duplicate variable ${init.name}`);
    }
    locals.vars.set(init.name, tcInit(env, init).type);
  });
  fun.decls.forEach((decl) => {
    if (locals.vars.has(decl.name) || !nestEnv.vars.has(decl.name)) {
      throw new BaseException.CompileError(decl.a, `Invalid Nonlocal Variable ${decl.name}`);
    }
  });

  fun.funs.forEach((func) => {
    locals.functions.set(func.name, [func.parameters, func.ret]);
    if (locals.vars.has(func.name)) {
      throw new BaseException.CompileError(func.a, `Duplicate variable ${func.name}`);
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
  return {
    ...fun,
    a: [NONE, fun.a],
    funs: tDefs,
    body: tBody,
    decls: fun.decls.map((s) => {
      return { ...s, a: [undefined, s.a] };
    }), // TODO
    inits: fun.inits.map((s) => tcInit(env, s)),
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

export function tcLambda(locals: LocalTypeEnv, expr: Expr<Location>, expected: Type) {
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
        destruct: tcDestructure(env, locals, stmt.destruct, tValueExpr.a[0], stmt.value),
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

      if (stmt.value.tag === "lambda" && locals.expectedRet.tag === "callable") {
        tcLambda(locals, stmt.value, locals.expectedRet);
      }
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
      const iterable_type = fIter.a[0]
      switch (iterable_type.tag) {
        case "class":
          if (iterable_type.name === "Range") {
            stmt.name.targets.forEach(target => {
              if(target.target.tag === "id"){
                locals.vars.set(target.target.name, NUM);
              }else{
                throw new BaseException.CompileError(stmt.a, "Destructure tc error. This should not happen, please contact for-loop developer Tianyang Zhang")
              }
            });
            break;
          } else {
            throw new BaseException.SyntaxError(
              stmt.a,
              "for-loop cannot take " + iterable_type.name + " class as iterator."
            );
          }
        case "string":
          // Character not implemented
          // locals.vars.set(stmt.name, {tag: 'char'});
          throw new BaseException.CompileError(stmt.a, "for-loop with strings are not implmented.");
        case "list":
          stmt.name.targets.forEach(target => {
            if(target.target.tag === "id"){
              locals.vars.set(target.target.name, iterable_type.content_type);
            }else{
              throw new BaseException.CompileError(stmt.a, "Destructure tc error. This should not happen, please contact for-loop developer Tianyang Zhang")
            }
          });
          break;
        default:
          throw new BaseException.SyntaxError(stmt.a, "Illegal iterating item in for-loop.");
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

      console.log("TC over", fIter.a[0])
      // return type checked stmt
      return {
        a: [NONE, stmt.a],
        id: stmt.id,
        tag: "for",
        name: tcDestructure( env, locals, stmt.name, NUM, stmt.iterable), // change NUM to fix this issue
        iterable: fIter,
        body: fBody,
      };
    case "break":
      if (locals.loop_depth < 1) {
        throw new BaseException.SyntaxError(stmt.a, "Break outside a loop.");
      }
      return { a: [NONE, stmt.a], tag: "break", depth: locals.loop_depth };
    case "continue":
      if (locals.loop_depth < 1) {
        throw new BaseException.SyntaxError(stmt.a, "Continue outside a loop.");
      }
      const depth = locals.loop_depth - 1;
      return { a: [NONE, stmt.a], tag: "continue", depth: depth };
    case "field-assign":
      var tObj = tcExpr(env, locals, stmt.obj);
      const tVal = tcExpr(env, locals, stmt.value);
      console.log("field a" + tObj.a);
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
 * @param expr Expr of the value passed into this destructure (only used for lambda expr)
 */
function tcDestructure(
  env: GlobalTypeEnv,
  locals: LocalTypeEnv,
  destruct: Destructure<Location>,
  value: Type,
  expr: Expr<Location>
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
    if (expr.tag === "lambda") {
      tcLambda(locals, expr, targetType[0]);
      valueType = tcExpr(env, locals, expr).a[0];
    }
    if (!isAssignable(env, valueType, targetType[0]))
      console.log("here!")
      throw new BaseException.TypeMismatchError(aTarget.target.a, targetType[0], valueType);
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
    // attrs.forEach((val) => types.push(val));
    attrs.forEach((val) => {
      if (val.tag === "callable" && val.isVar == false) return; // method should not count
      types.push(val);
    });
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
    case "lambda":
      throw new BaseException.TypeError(expr.a, "Lambda is not supported");
    /*
      var args: Type[] = [];
      expr.args.forEach((arg) => args.push(locals.vars.get(arg)));
      var callable: Type = { tag: "callable", args, ret: tcExpr(env, locals, expr.ret).a };
      return { ...expr, a: callable };
      */
    case "call_expr":
      if (expr.name.tag === "id" && env.classes.has(expr.name.name)) {
        // surprise surprise this is actually a constructor
        const tConstruct: Expr<[Type, Location]> = {
          a: [CLASS(expr.name.name), expr.a],
          tag: "construct",
          name: expr.name.name,
        };
        const [_, methods] = env.classes.get(expr.name.name);
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
      }

      var innercall = tcExpr(env, locals, expr.name);
      if (innercall.a[0].tag === "callable") {
        const [args, ret] = [innercall.a[0].args, innercall.a[0].ret];
        const params = args;
        const retType = ret;
        const argTypes = args.map((p) => p.type);
        const tArgs = expr.arguments.map((arg) => tcExpr(env, locals, arg));

        if (
          argTypes.length === expr.arguments.length &&
          tArgs.every((tArg, i) => isAssignable(env, tArg.a[0], argTypes[i]))
        ) {
          return { ...expr, a: [retType, expr.a], name: innercall, arguments: tArgs };
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
          var argNums = tArgs.length;
          while (argNums < argTypes.length) {
            if (params[argNums].value === undefined) {
              throw new BaseException.CompileError(expr.a, "Missing argument from call");
            } else {
              // add default values into arguments as an Expr
              augArgs = augArgs.concat([
                tcExpr(env, locals, { a: undefined, tag: "literal", value: params[argNums].value }),
              ]);
            }
            argNums = argNums + 1;
          }
          return { ...expr, a: [retType, expr.a], name: innercall, arguments: augArgs };
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
        // TODO incorrect parameter for call_expression
        throw new BaseException.NameError(expr.a, expr.name.tag);
      }
    case "call":
      if (expr.name == "range") {
        const tArgs = expr.arguments.map((arg) => tcExpr(env, locals, arg));
        return {
          a: [
            {
              tag: "class",
              name: "Range",
            },
            expr.a,
          ],
          tag: expr.tag,
          name: expr.name,
          arguments: tArgs,
        };
      }
      throw new TypeError("Parser should use call_expr instead whose callee is an expression.");
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
          const [fields, methods] = env.classes.get(tObj.a[0].name);

          var methodArgs: Type[];
          var methodRet: Type;
          if (fields.has(expr.method)) {
            var temp = fields.get(expr.method);
            // should always be true
            if (temp.tag === "callable") {
              [methodArgs, methodRet] = [temp.args.map((p) => p.type), temp.ret];
            }

            var realArgs: Expr<[Type, Location]>[] = tArgs;
            if (methods.has(expr.method)) {
              realArgs = [tObj].concat(tArgs);
            }
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
