
import { table } from 'console';
import { Stmt, Expr, Type, UniOp, BinOp, Literal, Program, FunDef, VarInit, Class} from './ast';
import { NUM, BOOL, NONE, UNSAT, FAILEDINFER, CLASS, STRING, LIST} from './utils';
import { emptyEnv } from './compiler';
import * as BaseException from "./error";


/*  
  Design choice: infer.ts will take an AST without type information, and add annotations where appropriate.
  Then the annotated AST will be returned.
  Then the type-checker will be used to *verify* that the typed-AST is actually consistent. 
  Going to leave room for constraint generation/solving to happen in here.
*/ 


// I feel like we should define type environments in this file perhaps?
export type GlobalTypeEnv = {
  globals: Map<string, Type>,
  functions: Map<string, [Array<Type>, Type]>,
  classes: Map<string, [Map<string, Type>, Map<string, [Array<Type>, Type]>]>
}

export type LocalTypeEnv = {
  vars: Map<string, Type>,
  expectedRet: Type,
  topLevel: Boolean
}



// Note: Probably don't need this?
// Represents a type constraint: type(lhs) == type(rhs)
export type TypeConstr = {lhs: TypeInfo, rhs: TypeInfo}

// Represents a type, along with its arity (for functions)
// ex. 5 has type Num, and a function f(x) can have type Num -> Num
export type TypeInfo = {type: Type, arity: Array<Type> }

// Type inference for a literal is a "hard" constraint.
export function inferTypeLit(lit : Literal) : Type {
  switch(lit.tag) {
    case "bool":
      return BOOL
    case "none":
      return NONE
    case "num":
      return NUM
    case "string":
      return STRING
  }
}

// Helper to check if a type is a list
export function isList(typ : Type) {
  return typ.tag === "list"
}

// Function to get the "join Type" C of two types A and B. C = Join(A, B)
export function joinType(leftType : Type, rightType : Type) {
  // basic implementation for now
  if (leftType === rightType) {
    return leftType
  }
  else {
    return UNSAT
  }
}

// Basic type inference for expression. Treats constraint generation/solving
// as a recursive substitution algorithm. Uses an existing type environment
// to look up types to variables.
export function inferExprType(expr: Expr<any>, globEnv : GlobalTypeEnv, locEnv : LocalTypeEnv) : Type {
  let typeTag : Type

  switch(expr.tag) {
    case "literal":  // Literals get a simple substitution
      typeTag = inferTypeLit(expr.value)
      return typeTag

    case "list-expr":
      throw new Error("Inference not implemented for lists yet")
    
    case "id":  // Does a type look up in an environment (created at an earlier stage)
      if (locEnv.vars.has(expr.name)) {
        return locEnv.vars.get(expr.name)
      } else if (globEnv.globals.has(expr.name)) {
        return globEnv.globals.get(expr.name)
      } else {
        return FAILEDINFER
      }

    case "binop": 
      var leftType = inferExprType(expr.left, globEnv, locEnv)
      var rightType = inferExprType(expr.right, globEnv, locEnv)
      if (leftType === FAILEDINFER || rightType === FAILEDINFER) {
        return FAILEDINFER
      }
      if (leftType === UNSAT || rightType === UNSAT) {
        return UNSAT
      }

      switch(expr.op) {
        case BinOp.Plus:  // Polymorphic for ints and strings and lists.
          if (leftType === STRING && rightType === STRING) {
            return STRING
          } else if (leftType === NUM && rightType === NUM) {
            return NUM
          } else if (isList(leftType) && isList(rightType)) {
            return joinType(leftType, rightType)
          } else { // typing constraints unsatisfiable
            return UNSAT
          }
        
        case BinOp.Minus:
        case BinOp.Mul:
        case BinOp.IDiv:
        case BinOp.Mod:
          if (leftType === NUM && rightType === NUM) {
            return NUM
          } else {
            return UNSAT
          }

        case BinOp.Eq:

          
      }      
  }
}

export function inferTypeProgram(program: Program<null>) : Program<Type> {
  throw new Error("Inference not implemented for full programs yet")
} 