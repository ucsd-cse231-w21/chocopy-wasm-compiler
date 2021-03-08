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
  isSubtype,
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
export function buildTypedExpr(
  expr: Expr<any>,
  globEnv: GlobalTypeEnv,
  locEnv: LocalTypeEnv): Expr<Type> {
  throw new Error("Type completion is not implemented for expressions");
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
      const value = buildTypedExpr(stmt.value, globEnv, locEnv);
      let a = value.a;
      if (locEnv.vars.has(stmt.name)) {
        let type_ = locEnv.vars.get(stmt.name);
        // FIXME: make isSubtype work with LocalTypeEnv since this is a local
        // variable we are talking about
        if (!isSubtype(globEnv, a, type_)) {
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
      const value = buildTypedExpr(stmt.value, globEnv, locEnv);
      let a = value.a;
      return { ...stmt, a, value };
    }
    case "expr": {
      const expr = buildTypedExpr(stmt.expr, globEnv, locEnv);
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
      const value = buildTypedExpr(stmt.value, globEnv, locEnv);
      const obj = buildTypedExpr(stmt.obj, globEnv, locEnv);
      let a: Type;
      if (obj.a === UNSAT
          || value.a === UNSAT
          || obj.a.tag != "class"
          || !globEnv.classes.has(obj.a.name)  // if class map contains the class
          || !globEnv.classes.get(obj.a.name)[0].has(stmt.field) // if the class contains the field
          || !isSubtype(globEnv, globEnv.classes.get(obj.a.name)[0].get(stmt.field), value.a)) {
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
        index = buildTypedExpr(stmt.index, globEnv, locEnv);
      }
      const iterable = buildTypedExpr(stmt.iterable, globEnv, locEnv);
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
      throw new Error(`Type completion is not implemented for: ${stmt}`);
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
