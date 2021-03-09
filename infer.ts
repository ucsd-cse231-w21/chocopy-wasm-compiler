import { table } from "console";
import { Stmt, Expr, Type, UniOp, BinOp, Literal, Program, FunDef, VarInit, Class } from "./ast";
import { NUM, BOOL, NONE, UNSAT, FAILEDINFER, CLASS, STRING, LIST } from "./utils";
import {
  augmentTEnv,
  equalType,
  defaultTypeEnv,
  emptyGlobalTypeEnv,
  emptyLocalTypeEnv,
  isNoneOrClass,
  GlobalTypeEnv,
  LocalTypeEnv
} from "./type-check";
import { emptyEnv } from "./compiler";
import * as BaseException from "./error";

/*  
  Design choice: infer.ts will take an AST without type information, and add annotations where appropriate.
  Then the annotated AST will be returned.
  Then the type-checker will be used to *verify* that the typed-AST is actually consistent. 
  Going to leave room for constraint generation/solving to happen in here.
*/

// Note: Probably don't need this?
// Represents a type constraint: type(lhs) == type(rhs)
export type TypeConstr = { lhs: TypeInfo; rhs: TypeInfo };

// Represents a type, along with its arity (for functions)
// ex. 5 has type Num, and a function f(x) can have type Num -> Num
export type TypeInfo = { type: Type; arity: Array<Type> };

// Type inference for a literal is a "hard" constraint.
export function inferTypeLit(lit: Literal): Type {
  switch (lit.tag) {
    case "bool":
      return BOOL;
    case "none":
      return NONE;
    case "num":
      return NUM;
    case "string":
      return STRING;
  }
}

// check if t1 is a subtype of t2
export function isSubtype(t1: Type, t2: Type, globEnv: GlobalTypeEnv): boolean {
  if (t1.tag == "none") {
    return t2.tag == "class";
  } else if (t1.tag != "class" || t2.tag != "class") {
    return t1.tag == t2.tag
  } else if (!globEnv.classes.has(t1.name)) {
    throw new Error(`Unknown class: ${t1.name}`);
  } else if (!globEnv.classes.has(t2.name)) {
    throw new Error(`Unknown class: ${t2.name}`);
  } else {
    // get stuff
    const t1members = globEnv.classes.get(t1.name);
    const t2members = globEnv.classes.get(t2.name);
    const t1fields = t1members[0];
    const t2fields = t2members[0];
    const t1methods = t1members[1];
    const t2methods = t2members[1];

    // Check that t1fields is a subset of t2fields. We do this by iterating
    // through all the fields of t1 and check that t2 contains every one of
    // them.
    for (const [field, left] of t1fields.entries()) {
      if (!t2fields.has(field)) {
        return false
      }
      const right = t2fields.get(field);
      // Afterward, we check that the type of each corresponding field in t1 is
      // of a subtype of its t2 counterpart. FIXME: this is the one thing I'm
      // not 100% sure about
      if (!isSubtype(left, right, globEnv)) {
        return false
      }
    }

    // Check that t1methods is a subset of t2methods. We do this by iterating
    // through all the methods of t1 and check that t2 contains every one of
    // them
    for (const [method, [argTypes1, retType1]] of t2methods.entries()) {
      if (!t2methods.has(method)) {
        return false
      }
      // Afterward, we check that the arguement types of each corresponding
      // method in t1 is of a subtype of that of its t2 counterpart. FIXME:
      // ditto above
      const [argTypes2, retType2] = t2methods.get(method);
      for (const [left, right] of argTypes1.map((t, i) => [t, argTypes2[i]])) {
        if (!isSubtype(left, right, globEnv)) {
          return false
        }
      }
      // We also check that the return type of t1 is a subtype of that of t2.
      // FIXME: ditto above
      if (!isSubtype(retType1, retType2, globEnv)) {
        return false
      }
    }

    // if there hasn't been an early return, t1 is a subtrype of t2
    return true
  }
}

// Helper to check if a type is a list
export function isList(typ: Type): boolean {
  return typ.tag === "list";
}

// Function to get the "join Type" C of two types A and B. C = Join(A, B)
export function joinType(leftType: Type, rightType: Type): Type {
  // basic implementation for now
  if (leftType === rightType) {
    return leftType;
  } else {
    return UNSAT;
  }
}

// Basic type inference for expression. Treats constraint generation/solving
// as a recursive substitution algorithm. Uses an existing type environment
// to look up types to variables.
export function inferExprType(expr: Expr<any>, globEnv: GlobalTypeEnv, locEnv: LocalTypeEnv): Type {
  let typeTag: Type;

  switch (expr.tag) {
    case "literal": // Literals get a simple substitution
      typeTag = inferTypeLit(expr.value);
      return typeTag;

    // prepopulate the globEnv with builtin functions
    case "builtin1": // TODO
    case "builtin2": // TODO
      throw new Error("Inference for built-ins not supported yet");
    case "call": // TODO
      throw new Error("Inference for calls not supported yet");
    case "list-expr":
      throw new Error("Inference not implemented for lists yet");

    case "id": // Does a type look up in an environment (created at an earlier stage)
      if (locEnv.vars.has(expr.name)) {
        return locEnv.vars.get(expr.name);
      } else if (globEnv.globals.has(expr.name)) {
        return globEnv.globals.get(expr.name);
      } else {
        return FAILEDINFER;
      }

    case "uniop":
      var exprType = inferExprType(expr.expr, globEnv, locEnv);
      if (exprType === UNSAT) {
        return UNSAT;
      }
      if (exprType === FAILEDINFER) {
        return FAILEDINFER;
      }

      switch (expr.op) {
        case UniOp.Neg:
          if (exprType != NUM) {
            return UNSAT;
          } else {
            return NUM;
          }
        case UniOp.Not:
          if (exprType != BOOL) {
            return UNSAT;
          } else {
            return BOOL;
          }
      }
      break;

    case "binop":
      var leftType = inferExprType(expr.left, globEnv, locEnv);
      var rightType = inferExprType(expr.right, globEnv, locEnv);
      if (leftType === FAILEDINFER || rightType === FAILEDINFER) {
        return FAILEDINFER;
      }
      if (leftType === UNSAT || rightType === UNSAT) {
        return UNSAT;
      }

      switch (expr.op) {
        case BinOp.Plus: // Polymorphic for ints and strings and lists.
          if (leftType === STRING && rightType === STRING) {
            return STRING;
          } else if (leftType === NUM && rightType === NUM) {
            return NUM;
          } else if (isList(leftType) && isList(rightType)) {
            return joinType(leftType, rightType);
          } else {
            // typing constraints unsatisfiable
            return UNSAT;
          }

        case BinOp.Minus:
        case BinOp.Mul:
        case BinOp.IDiv:
        case BinOp.Mod:
          if (leftType === NUM && rightType === NUM) {
            return NUM;
          } else {
            return UNSAT;
          }

        // three cases: num-compare, bool-compare, str-compare
        case BinOp.Eq:
        case BinOp.Neq:
          if (equalType(leftType, rightType)) {
            // properly handle classes later
            return BOOL;
          } else {
            return UNSAT;
          }

        case BinOp.Gt:
        case BinOp.Gte:
        case BinOp.Lt:
        case BinOp.Lte:
          if (leftType === NUM && rightType === NUM) {
            return BOOL;
          } else {
            return UNSAT;
          }

        case BinOp.Or:
        case BinOp.And:
          if (leftType === BOOL && rightType === BOOL) {
            return BOOL;
          } else {
            return UNSAT;
          }

        case BinOp.Is:
          if (isNoneOrClass(leftType) && isNoneOrClass(rightType)) {
            return BOOL;
          } else {
            // TODO: is this true for int is int or bool is bool?
            return UNSAT;
          }
      }
      break;

    default:
      throw new Error(`Inference not implemented for expressions with tag: '${expr.tag}'`);
  }
}

// must update the *Env maps when the function is called
// TODO: might need to reorder some of the entries.
export function buildTypedExpr(
  expr: Expr<any>,
  globEnv: GlobalTypeEnv,
  locEnv: LocalTypeEnv,
  topLevel: boolean
): Expr<Type> {
  const a = inferExprType(expr, globEnv, locEnv);
  switch (expr.tag) {
    case "literal":
      return { ...expr, a: inferExprType(expr, globEnv, locEnv) };
    case "binop": {
      const left = buildTypedExpr(expr.left, globEnv, locEnv, topLevel);
      const right = buildTypedExpr(expr.right, globEnv, locEnv, topLevel);
      return { ...expr, a, left, right };
    }
    case "uniop": {
      const expr_ = buildTypedExpr(expr.expr, globEnv, locEnv, topLevel);
      return { ...expr, expr: expr_, a };
    }
    case "builtin1": {
      const arg = buildTypedExpr(expr.arg, globEnv, locEnv, topLevel);
      return { ...expr, arg , a };
    }
    case "builtin2": {
      const left = buildTypedExpr(expr.left, globEnv, locEnv, topLevel);
      const right = buildTypedExpr(expr.right, globEnv, locEnv, topLevel);
      return { ...expr, left, right , a };
    }
    case "id":
      return { ...expr, a };
    case "lookup": {
      const obj = buildTypedExpr(expr.obj, globEnv, locEnv, topLevel);
      return { ...expr, a, obj };
    }
    case "method-call": {
      let obj = buildTypedExpr(expr.obj, globEnv, locEnv, topLevel);
      let arguments_ = expr.arguments.map(s => buildTypedExpr(s, globEnv, locEnv, topLevel));
      return { ...expr, obj, arguments: arguments_, a };
    }
    case "construct":
      return { ...expr, a };
    case "lambda": {
      const ret = buildTypedExpr(expr.ret, globEnv, locEnv, topLevel);
      return { ...expr, a, ret };
    }
    case "comprehension": {
      const expr_ = buildTypedExpr(expr.expr, globEnv, locEnv, topLevel);
      const iter = buildTypedExpr(expr.iter, globEnv, locEnv, topLevel);
      let cond;
      if (expr.cond !== undefined) {
        cond = buildTypedExpr(expr.cond, globEnv, locEnv, topLevel);
      }
      return { ...expr, a, expr: expr_, iter, cond }
    }
    case "block": {
      const block = expr.block.map(s => buildTypedStmt(s, globEnv, locEnv, topLevel));
      const expr_ = buildTypedExpr(expr.expr, globEnv, locEnv, topLevel);
      return { ...expr, a, block, expr: expr_ };
    }
    case "list-expr": {
      const contents = expr.contents.map(s => buildTypedExpr(s, globEnv, locEnv, topLevel));
      return { ...expr, a, contents };
    }
    case "string_slicing": {
      const name = buildTypedExpr(expr.name, globEnv, locEnv, topLevel);
      const start = buildTypedExpr(expr.start, globEnv, locEnv, topLevel);
      const end = buildTypedExpr(expr.end, globEnv, locEnv, topLevel);
      const stride = buildTypedExpr(expr.stride, globEnv, locEnv, topLevel);
      return { ...expr, a, name, start, end, stride };
    }
    case "dict": {
      let entries = [];
      for (const [key, val] of expr.entries) {
        const key_ = buildTypedExpr(key, globEnv, locEnv, topLevel);
        const val_ = buildTypedExpr(val, globEnv, locEnv, topLevel);
        const entry: [Expr<Type>, Expr<Type>] = [key, val];
        entries.push(entry);
      }
      return { ...expr, a, entries };
    }
    case "bracket-lookup": {
      const obj = buildTypedExpr(expr.obj, globEnv, locEnv, topLevel);
      const key = buildTypedExpr(expr.key, globEnv, locEnv, topLevel);
      return { ...expr, a, obj, key };
    }
    default:
      throw new Error(`Type completion not implemented for expressions with tag: '${expr.tag}'`);
  }
}

// For now this doesn't work with globals--all variables must be defined in the
// current scope
export function buildTypedStmt(
  stmt: Stmt<any>,
  globEnv: GlobalTypeEnv,
  locEnv: LocalTypeEnv,
  topLevel: boolean
): Stmt<Type> {
  switch (stmt.tag) {
    // FIXME: finish this. Tricky
    // case "assignment":
    //   const value = buildTypedExpr(stmt.value, globEnv, locEnv);
    //   return { ...stmt, value };
    case "assign": {
      const value = buildTypedExpr(stmt.value, globEnv, locEnv, topLevel);
      let a = value.a;
      if (locEnv.vars.has(stmt.name)) {
        let type_ = locEnv.vars.get(stmt.name);
        // FIXME: make isSubtype work with LocalTypeEnv since this is a local
        // variable we are talking about
        if (!isSubtype(type_, a, globEnv)) {
          a = UNSAT;
        }
      } else {
        locEnv.vars.set(stmt.name, a);
      }
      return { ...stmt, a, value };
    }
    // TODO: For now we only infer the type of the return value by the RHS.
    // We might need to restructure part of the code to get it to infer the type
    // of the returned value from the call site
    case "return": {
      const value = buildTypedExpr(stmt.value, globEnv, locEnv, topLevel);
      let a = value.a;
      return { ...stmt, a, value };
    }
    case "expr": {
      const expr = buildTypedExpr(stmt.expr, globEnv, locEnv, topLevel);
      const a = expr.a;
      return { tag: "expr", a, expr };
    }
    // TODO: the tricky part. will do later
    // case "if": {
    // }
    // case "while": {
    // }
    // FIXME: how about the case where multiple classes have fields that share
      // the same name with different types?
    case "field-assign": {
      const value = buildTypedExpr(stmt.value, globEnv, locEnv, topLevel);
      const obj = buildTypedExpr(stmt.obj, globEnv, locEnv, topLevel);
      let a: Type;
      if (obj.a === UNSAT
          || value.a === UNSAT
          || obj.a.tag != "class"
          || !globEnv.classes.has(obj.a.name)  // if class map contains the class
          || !globEnv.classes.get(obj.a.name)[0].has(stmt.field) // if the class contains the field
          || !isSubtype(globEnv.classes.get(obj.a.name)[0].get(stmt.field), value.a, globEnv)) {
          a = UNSAT;
      } else {
        a = globEnv.classes.get(obj.a.name)[0].get(stmt.field);
      }
      // TODO: not entirely sure if this is the way to determine a
      return { ...stmt, a, obj, value };
    }
    case "for": {
      let index;
      if (stmt.index !== undefined) {
        index = buildTypedExpr(stmt.index, globEnv, locEnv, topLevel);
      }
      const iterable = buildTypedExpr(stmt.iterable, globEnv, locEnv, topLevel);
      const body = stmt.body.map(s => buildTypedStmt(s, globEnv, locEnv, topLevel));
      // TODO: not entirely sure about the value of a
      const a = iterable.a;
      return { ...stmt, a, iterable, body, index };
    }
    // FIXME: what the hell of bracket-assign?
    // case "bracket-assign" {
    // }
    case "pass":
    case "continue":
    case "break":
      return stmt
    default:
      throw new Error(`Type completion is not implemented for the following statement: ${stmt}`);
  }
}

export function buildTypedAST(program: Program<null>): Program<Type> {
  // gather any type information that the user provided
  const globEnv = augmentTEnv(defaultTypeEnv, program);
  const locEnv = emptyLocalTypeEnv();
  // we now infer types of the program statement by statement
  const stmts = program.stmts.map(s => buildTypedStmt(s, globEnv, locEnv, true));

  throw new Error("Type completion is not implemented for full programs yet");
}
