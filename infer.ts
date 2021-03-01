
import { table } from 'console';
import { Stmt, Expr, Type, UniOp, BinOp, Literal, Program, FunDef, VarInit, Class} from './ast';
import { NUM, BOOL, NONE, UNSAT, FAILEDINFER, CLASS, STR } from './utils';
import { emptyEnv } from './compiler';
import * as BaseException from "./error";


/*  
  Design choice: infer.ts will take an AST without type information, and add annotations where appropriate.
  Then the annotated AST will be returned.
  Then the type-checker will be used to *verify* that the typed-AST is actually consistent. 
  Going to leave room for constraint generation/solving to happen in here.
*/ 


// Basic type inference for expression. Returns an annotated Expression type
// Right now this doesn't really generate constraints, but could be amended later.
export function inferTypeExpr(expr: Expr<any>) : Expr<Type> {
  switch(expr.tag) {
    case "literal":
      var typeTag : Type
      if (expr.value.tag === 'bool') {
        typeTag = BOOL
      }
      else if (expr.value.tag === 'num') {
        typeTag = NUM
      }
      else if (expr.value.tag === 'string') {
        typeTag = STR
      }
      else if (expr.value.tag === 'none') {
        typeTag = NONE
      }
      return {a: typeTag, tag: "literal", value:expr.value}
    
    case "binop":  // In principle we can get the 
      var typeTag : Type
      var leftExpr = inferTypeExpr(expr.left)
      var rightExpr = inferTypeExpr(expr.right)

      // Ask user for a type annotation of expression
      if (leftExpr.a === FAILEDINFER || rightExpr.a === FAILEDINFER) {
        typeTag = FAILEDINFER
        return {...expr, a : typeTag}
      }
      
      // Subexpression broke, propogate that back up.
      if (leftExpr.a === UNSAT || rightExpr.a === UNSAT) {
        typeTag = UNSAT
        return {...expr, a : typeTag}
      }

      switch(expr.op) {
        case BinOp.Plus:  // Should only be defined for strings or for 
          if (leftExpr.a === STR && rightExpr.a === STR) {
            typeTag = STR
          }
          else if (leftExpr.a === NUM && rightExpr.a === NUM) {
            typeTag = NUM
          }
          else {  // Going to assume that this means a type check error will happen, for now
            typeTag = UNSAT
          }
          return {...expr, a : typeTag}
          
      }
  }
}