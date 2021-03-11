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
import { emptyEnv, GlobalEnv } from "./compiler";
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

enum Action {
  None,
  Repeat
}

function joinAction(left: Action, right: Action): Action {
  if (left === Action.None && right === Action.None) {
    return Action.None;
  } else {
    return Action.Repeat;
  }
}

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

// function isSubtypeFields(t1fields: Map<string, Type>,
//                          t2fields: Map<string, Type>,
//                          globEnv: GlobalTypeEnv): boolean {
//   // Check that t1fields is a subset of t2fields. We do this by iterating
//   // through all the fields of t1 and check that t2 contains every one of
//   // them.
//   for (const [field, left] of t1fields.entries()) {
//     if (!t2fields.has(field)) {
//       return false
//     }
//     const right = t2fields.get(field);
//     // Afterward, we check that the type of each corresponding field in t1 is
//     // of a subtype of its t2 counterpart.
//     if (!isSubtype(globEnv, left, right)) {
//       return false
//     }
//   }

//   return true
// };


// t : Counter = Counter()
// class A(object):
//     def m(self: A) -> A:
// class B(object):
//     def m(self:B ) -> B:

// function isSubtypeMethods(t1methods: Map<string, [Type[], Type]>,
//                           t2methods: Map<string, [Type[], Type]>,
//                           globEnv: GlobalTypeEnv): boolean {
//   // Check that t1methods is a subset of t2methods. We do this by iterating
//   // through all the methods of t1 and check that t2 contains every one of
//   // them
//   for (const [method, [argTypes1, retType1]] of t1methods.entries()) {
//     if (!t2methods.has(method)) {
//       return false
//     }
//     // Afterward, we check that the arguement types of each corresponding
//     // method in t1 is of a subtype of that of its t2 counterpart.
//     const [argTypes2, retType2] = t2methods.get(method);
//     for (const [i, [left, right]] of argTypes1.map((t, i) => [t, argTypes2[i]]).entries()) {
//       if (i == 0) {
//         continue
//       } else {
//         if (!isSubtype(globEnv, left, right)) {
//           return false
//         }
//       }
//     }
//     // We also check that the return type of t1 is a subtype of that of t2.
//     if (!isSubtype(globEnv, retType1, retType2)) {
//       return false
//     }
//   }
//   return true
// }

// check if t1 is a subtype of t2
export function isSubtype(globEnv: GlobalTypeEnv, t1: Type, t2: Type): boolean {
  if (t1.tag == "none") {
    return t2.tag == "class";
  // } else if (t1.tag == "open-object" && t2.tag == "open-object") {
  //   return isSubtypeFields(t1.fields, t2.fields, globEnv)
  //       && isSubtypeMethods(t1.methods, t2.methods, globEnv);
  // } else if (t1.tag == "open-object" && t2.tag == "class") {
  //   const [t2fields, t2methods] = globEnv.classes.get(t2.name);
  //   return isSubtypeFields(t1.fields, t2fields, globEnv)
  //       && isSubtypeMethods(t1.methods, t2methods, globEnv);
  // } else if (t1.tag == "class" && t2.tag == "open-object") {
  //   const [t1fields, t1methods] = globEnv.classes.get(t1.name);
  //   return isSubtypeFields(t1fields, t2.fields, globEnv)
  //       && isSubtypeMethods(t1methods, t2.methods, globEnv);
  } else if (t1.tag == "class" && t2.tag == "class") {
    return t1.name == t2.name;
  //   if (t1.name == t2.name) {
  //     return true
  //   } else if (!globEnv.classes.has(t1.name)) {
  //     throw new Error(`Unknown class: ${t1.name}`);
  //   } else if (!globEnv.classes.has(t2.name)) {
  //     throw new Error(`Unknown class: ${t2.name}`);
  //   } else {
  //     const [t1fields, t1methods] = globEnv.classes.get(t1.name);
  //     const [t2fields, t2methods] = globEnv.classes.get(t2.name);

  //     return isSubtypeFields(t1fields, t2fields, globEnv)
  //         && isSubtypeMethods(t1methods, t2methods, globEnv);
  //   }
  } else {
    return t1.tag == t2.tag
  }
}

// Helper to check if a type is a list
export function isList(typ: Type): boolean {
  return typ.tag === "list";
}

enum joinStatus {
  Success,
  Failure
}

// // find the union of fields
// function joinFields(leftFields: Map<string, Type>,
//                     rightFields: Map<string, Type>,
//                     globEnv: GlobalTypeEnv): [joinStatus, Map<string, Type>] {
//   const fields = new Map(leftFields);
//   for (const [field, type_] of rightFields.entries()) {
//     if (!fields.has(field)) {
//       fields.set(field, type_);
//     } else {
//       const leftType = fields.get(field);
//       // intersection = 0
//       if (!isSubtype(globEnv, leftType, type_) && !isSubtype(globEnv, type_, leftType)) {
//         return [joinStatus.Failure, new Map];
//       // if leftType is a subtype of type_, upcast the type, do nothing
//       // otherwise
//       } else if (isSubtype(globEnv, leftType, type_)) {
//         fields.set(field, type_);
//       }
//     }
//   }

//   return [joinStatus.Success, fields];
// }

// // find the union of methods
// function joinMethods(leftMethods: Map<string, [Type[], Type]>,
//                      rightMethods: Map<string, [Type[], Type]>,
//                      globEnv: GlobalTypeEnv): [joinStatus, Map<string, [Type[], Type]>] {
//   const methods = new Map(leftMethods);
//   for (const [method, [rightArgTypes, rightRetType]] of rightMethods.entries()) {
//     if (!methods.has(method)) {
//       methods.set(method, [rightArgTypes, rightRetType]);
//     } else {
//       const [leftArgTypes, leftRetType] = methods.get(method);
//       // intersection = 0
//       if (leftArgTypes.length != rightArgTypes.length) {
//         return [joinStatus.Failure, new Map];
//       } else if (!isSubtype(globEnv, leftRetType, rightRetType)
//               && !isSubtype(globEnv, rightRetType, leftRetType)) {
//         return [joinStatus.Failure, new Map];
//       } else {
//         let joinedArgTypes = [];
//         for (const [i, leftArgType] of leftArgTypes.entries()) {
//           const rightArgType = rightArgTypes[i];
//           const joinedType = joinType(leftArgType, rightArgType, globEnv);
//           if (joinedType === UNSAT) {
//             return [joinStatus.Failure, new Map];
//           } else {
//             joinedArgTypes.push(joinedType);
//           }
//         }

        // const joinedRetType = joinType(leftRetType, rightRetType, globEnv);
        // if (joinedRetType === UNSAT) {
        //   return [joinStatus.Failure, new Map];
        // }

  //       methods.set(method, [joinedArgTypes, joinedRetType]);
  //     }
  //   }
  // }

//   return [joinStatus.Success, methods];
// }

// For now, this joins two types even if they have fields/methods with different
// types as long as they are compatible. This could be restricted later if it
// causes problems.
export function joinType(leftType: Type, rightType: Type, globEnv: GlobalTypeEnv): Type {
  if (leftType.tag == "failedToInfer") {
    return rightType
  } else if (rightType.tag == "failedToInfer") {
    return leftType;
  } else if (leftType.tag == "class"
          && rightType.tag == "class"
          && leftType.name == rightType.name) {
    return leftType
  // } else if (leftType.tag == "class" && rightType.tag == "open-object"
  //         || leftType.tag == "open-object" && rightType.tag == "class"
  //         || leftType.tag == "open-object" && rightType.tag == "open-object") {
  //   type OpenObj = {
  //     tag: "open-object";
  //     fields: Map<string, Type>;
  //     methods: Map<string, [Array<Type>, Type]>
  //   };
  //   type Class = { tag: "class"; name: string };
  //   type member = [Map<string, Type>, Map<string, [Array<Type>, Type]>];

  //   const extractMembers = (t: OpenObj | Class, m: member) => {
  //     if (t.tag == "class") {
  //       if (globEnv.classes.has(t.name)) {
  //         m = globEnv.classes.get(t.name);
  //       } else {
  //         throw new Error(`Unknown class: ${t.name}`);
  //       }
  //     } else {
  //       m = [t.fields, t.methods];
  //     }
  //   };

  //   let leftMembers: member;
  //   let rightMembers: member;
  //   extractMembers(leftType, leftMembers);
  //   extractMembers(rightType, rightMembers);

  //   const [leftFields, leftMethods] = leftMembers;
  //   const [rightFields, rightMethods] = rightMembers;
  //   const [s1, fields] = joinFields(leftFields, rightFields, globEnv);
  //   const [s2, methods] = joinMethods(leftMethods, rightMethods, globEnv);

  //   if (s1 === joinStatus.Failure || s2 === joinStatus.Failure) {
  //     return UNSAT;
  //   } else {
  //     return { tag: "open-object", fields, methods };
  //   }
  } else {
    if (leftType === rightType) {
      return leftType;
    } else {
      return UNSAT;
    }
  }
}

// Basic type inference for expression. Treats constraint generation/solving
// as a recursive substitution algorithm. Uses an existing type environment
// to look up types to variables.
export function inferExprType(expr: Expr<any>, globEnv: GlobalTypeEnv, locEnv: LocalTypeEnv): Type {
  // if the type has been filled in, return the existing tag
  if (expr.a !== undefined) {
    return expr.a;
  }

  let typeTag: Type;

  switch (expr.tag) {
    case "literal": // Literals get a simple substitution
      typeTag = inferTypeLit(expr.value);
      return typeTag;
    case "builtin1":
      let argType = inferExprType(expr.arg, globEnv, locEnv);
      if (argType === UNSAT) {
        return UNSAT;
      }
      if (argType === FAILEDINFER) {
        return FAILEDINFER;
      }
      switch (expr.name) {
        case "print":
          return NONE;
        case "abs":
          return NUM;
        default:
          throw new Error(`Inference not supported for unknown builtin '${expr.name}'`)
      }
    case "builtin2":
      let lhs = inferExprType(expr.left, globEnv, locEnv);
      let rhs = inferExprType(expr.right, globEnv, locEnv);
      if (lhs === UNSAT || rhs === UNSAT) {
        return UNSAT;
      }
      if (lhs === FAILEDINFER || rhs === FAILEDINFER) {
        return FAILEDINFER;
      }
      switch (expr.name) {
        case "min": case "max": case "pow":
          return NUM;
        default:
        throw new Error(`Inference not supported for unknown builtin '${expr.name}'`)
      }
    case "call":
      if (globEnv.classes.has(expr.name)) {
        return CLASS(expr.name);
      }
      // if (globEnv.inferred_functions.has(expr.name)) {
      //   return globEnv.inferred_functions.get(expr.name)[1];
      // }
      else if (globEnv.functions.has(expr.name)) {
        let [_, retType] = globEnv.functions.get(expr.name);
        return retType;
      } else {
        return FAILEDINFER;
      }

    case "method-call":
      let objType = inferExprType(expr.obj, globEnv, locEnv);
      if (objType === UNSAT) {
        return UNSAT;
      }
      if (objType === FAILEDINFER || objType.tag !== "class") {
        return FAILEDINFER;
      }
      // we have been able to infer the type of the class before the dot
      if (!globEnv.classes.has(objType.name)) {
        return FAILEDINFER;
      }

      const [_, methods] = globEnv.classes.get(objType.name);
      if (!methods.has(expr.method)) {
        return FAILEDINFER;
      } else {
        let [_, returnType] = methods.get(expr.method)
        return returnType;
      }

    case "lookup":
      let oType = inferExprType(expr.obj, globEnv, locEnv);
      if (oType === UNSAT) {
        return UNSAT;
      }
      if (oType === FAILEDINFER || oType.tag !== "class") {
        return FAILEDINFER;
      }
      if (!globEnv.classes.has(oType.name)) {
        return FAILEDINFER;
      }
      let [fields, ms] = globEnv.classes.get(oType.name);
      if (!fields.has(expr.field)) {
        return FAILEDINFER;
      } else {
        let returnType = fields.get(expr.field)
        return returnType;
      }

    case "list-expr":
      throw new Error("Inference not implemented for lists yet");

    case "id": // Does a type look up in an environment (created at an earlier stage)
      if (locEnv.vars.has(expr.name)) {
        if (locEnv.vars.get(expr.name) !== undefined) {
          return locEnv.vars.get(expr.name);
        } else {
          return FAILEDINFER;
        }
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
      if (rightType === FAILEDINFER) {
        return leftType;
      } else if (leftType === FAILEDINFER) {
        return rightType;
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
            return joinType(leftType, rightType, globEnv);
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

// First pass inference to reach into function body and infer return types
// This is to get easy constraints.
export function inferReturnType(funDef: FunDef<any>, globEnv: GlobalTypeEnv, locEnv: LocalTypeEnv) : Type {
  let s = Action.None;
  let body_ = []

  // Easy case where a type annotation was provided.
  // if (funDef.ret !== undefined) {
  //   return funDef.ret
  // }

  for (const st of funDef.body) {
    const [s_, stmt_] = annotateStmt(st, globEnv, locEnv, false);
    s = joinAction(s, s_);
    body_.push(stmt_);
  };

  funDef.body = body_
  funDef.parameters.forEach((p) => {
    if (locEnv.vars.has(p.name)) {
      p.type = locEnv.vars.get(p.name)
    }
  })
  return inferRetTypeHepler(funDef.body, globEnv)
}

function inferRetTypeHepler(block: Array<Stmt<Type>>, globEnv: GlobalTypeEnv): Type {
  let retType : Type = NONE
  for (const st of block) {
    if (st.tag === "return") {
      retType = st.a
      break
    } else if (st.tag === "if") {
      let thenRetType = inferRetTypeHepler(st.thn, globEnv)
      let elseRetType = inferRetTypeHepler(st.els, globEnv)
      retType = joinType(thenRetType, elseRetType, globEnv)
      break;
    } else if (st.tag === "while") {
      retType = inferRetTypeHepler(st.body, globEnv);
      break
    }
  }
  return retType;
}

export function constrainExprType(
  expr: Expr<any>,
  type_: Type,
  globEnv: GlobalTypeEnv,
  locEnv: LocalTypeEnv
): [Action, Expr<Type>] {
  if (expr.a !== FAILEDINFER) {
    const a = isSubtype(globEnv, expr.a, type_) ? expr.a : UNSAT;
    return [Action.None, { ...expr, a }];
  }

  switch (expr.tag) {
    case "literal": {
      const type__ = inferExprType(expr, globEnv, locEnv);
      const a = equalType(type__, type_) ? type_ : UNSAT;
      return [Action.None, { ...expr, a }];
    }
    case "uniop": {
      switch (expr.op) {
        case UniOp.Neg:
          if (type_ !== NUM) {
            return [Action.None, { ...expr, a: UNSAT }];
          }
        case UniOp.Not:
          if (type_ !== BOOL) {
            return [Action.None, { ...expr, a: UNSAT }];
          }
      }
      return [Action.None, { ...expr }];
    }
    case "binop": {
      let left = { ...expr.left };
      let right = { ...expr.right };
      let leftAction;
      let rightAction;
      switch (expr.op) {
        case BinOp.Plus: {
          switch (type_.tag) {
            case "string":
              [leftAction, left] = constrainExprType(expr.left, STRING, globEnv, locEnv);
              [rightAction, right] = constrainExprType(expr.right, STRING, globEnv, locEnv);
              break
            case "number":
              [leftAction, left] = constrainExprType(expr.left, NUM, globEnv, locEnv);
              [rightAction, right] = constrainExprType(expr.right, NUM, globEnv, locEnv);
              break
            // might need to handle the case where content_type is FAILEDINFER
            case "list":
              [leftAction, left] = constrainExprType(expr.left, LIST(type_.content_type), globEnv, locEnv);
              [rightAction, right] = constrainExprType(expr.right, LIST(type_.content_type), globEnv, locEnv);
              break
          }
        }
        case BinOp.Minus:
        case BinOp.Mul:
        case BinOp.IDiv:
        case BinOp.Mod:
          if (type_ !== NUM) {
            return [joinAction(leftAction, rightAction), { ...expr, a: UNSAT }];
          } else {
            return [joinAction(leftAction, rightAction), { ...expr }];
          }
        case BinOp.Gt:
        case BinOp.Gte:
        case BinOp.Lt:
        case BinOp.Lte:
        case BinOp.Or:
        case BinOp.And:
          if (type_ !== BOOL) {
            return [joinAction(leftAction, rightAction), { ...expr, a: UNSAT }];
          } else {
            return [joinAction(leftAction, rightAction), { ...expr }];
          }
      }

      if (left.a === UNSAT || right.a === UNSAT) {
        return [joinAction(leftAction, rightAction), { ...expr, a: UNSAT, left, right }];
      } else {
        let a;
        switch (expr.op) {
          case BinOp.Eq:
          case BinOp.Neq:
          case BinOp.Is:
            a = BOOL;
            break
        }

        return [joinAction(leftAction, rightAction), { ...expr, a, left, right }];
      }
    }
    // For now we assume that the user doesn't overwrite builtin functions so
    // we impose hard constraints.
    case "builtin1":
    case "builtin2": {
      if (!globEnv.functions.has(expr.name)) {
        throw new Error(`Not a known built-in function: ${expr.name}`);
      }
      const retType = globEnv.functions.get(expr.name)[1];
      if (isSubtype(globEnv, retType, type_)) {
        return [Action.None, { ...expr }];
      } else {
        return [Action.Repeat, { ...expr, a: UNSAT }];
      }
    }
    // If the type we are imposing is a class/open-type, we impose the
    // requirement that the output of the call expression must provide the
    // defined methods and fields in the class/open-type, which means the return
    // type of the call expression must now be the union of imposed type and the
    // original type
    case "call": {
      let retType;
      if (!globEnv.functions.has(expr.name)
      // && !globEnv.inferred_functions.has(expr.name)
      ) {
        throw new Error(`Not a known function: ${expr.name}`);
      // inferred_functions contain functions that did not have fully specified
      // types
      // } else if (globEnv.inferred_functions.has(expr.name)) {
      //   retType = globEnv.inferred_functions.get(expr.name)[1];
      //   if (isSubtype(globEnv, retType, type_)) {
      //     return [Action.None, { ...expr }];
      //   } else {
      //     const [argTypes, retType_] = globEnv.inferred_functions.get(expr.name);
      //     const joinedRetType = joinType(retType, retType_, globEnv);
      //     if (joinedRetType === UNSAT) {
      //       return [Action.None, { ...expr, a: UNSAT }];
      //     } else {
      //       globEnv.inferred_functions.set(expr.name, [argTypes, joinedRetType]);
      //       return [Action.Repeat, { ...expr, a: joinedRetType }];
      //     }
      //   }
      } else {
        retType = globEnv.functions.get(expr.name)[1];
        // If the return type is none, one possibility is that user chose to
        // rely on the inference algorithm to figure it out.
        if (retType === NONE && type_ !== NONE) {
          const argTypes = globEnv.functions.get(expr.name)[0];
          const retType_ = type_;
          // globEnv.functions.delete(expr.name);
          //globEnv.inferred_functions.set(expr.name, [argTypes, retType_]);
          return [Action.Repeat, { ...expr, a: type_ }];
        }
        // If a function has a user specified return type that is not NONE, the
        // type constraint should be a hard constraint.
        if (isSubtype(globEnv, retType, type_)) {
          return [Action.None, { ...expr }];
        } else {
          return [Action.None, { ...expr, a: UNSAT }];
        }
      }
    }
    // If the type we are imposing is a class/open-type, we impose the
    // requirement that the id expression must provide the defined methods and
    // fields in the class/open-type, which means the type of the id expression
    // must now be the union of the imposed type and original type
    case "id": {
      if (locEnv.vars.has(expr.name)) {
        const a = locEnv.vars.get(expr.name);
        // a === undefined == expr.a === FAILEDINFER
        if (a === undefined) {
          locEnv.vars.set(expr.name, type_);
          return [Action.None, { ...expr, a: type_ }];
        } else if (!isSubtype(globEnv, a, type_)) {
          const a_ = joinType(a, type_, globEnv);
          if (a_ === UNSAT) {
            return [Action.None, { ...expr, a: UNSAT }];
          } else {
            locEnv.vars.set(expr.name, a_);
            return [Action.Repeat, { ...expr, a: a_ }];
          }
        } else {
          return [Action.None, { ...expr }];
        }
      } else {
        // if the local var isn't found in locEnv, set the type of the
        // expression to type_ and update locEnv (probably an open type)
        locEnv.vars.set(expr.name, type_);
        return [Action.None, { ...expr, a: type_ }];
      }
    }

    case "lookup": {
      let classes = []
      for (const [key, [fields, _]] of globEnv.classes.entries()) {
        if (fields.has(expr.field)) {
          if (fields.get(expr.field).tag === type_.tag) {
            classes.push(CLASS(key))
          }
        }
      }
      if (classes.length == 1) {
        const [s, obj] = constrainExprType(expr.obj, classes[0], globEnv, locEnv);
        if (obj.a === UNSAT) {
          return [Action.None, { ...expr, obj, a: UNSAT }];
        } else {
          return [s, { ...expr, obj, a: type_ }];
        }
      } else if (classes.length == 0) {
        return [Action.None, { ...expr, a: UNSAT }]
      } else {
        return [Action.None, { ...expr, a: FAILEDINFER }]
      }
    }
    default:
      throw new Error(`Not implemented for expression type: ${expr.tag}`);
  }
}

// must update the *Env maps when the function is called
// TODO: might need to reorder some of the entries.
export function annotateExpr(
  expr: Expr<any>,
  globEnv: GlobalTypeEnv,
  locEnv: LocalTypeEnv,
  topLevel: boolean
): [Action, Expr<Type>] {
  switch (expr.tag) {
    case "literal": {
      const a = inferExprType(expr, globEnv, locEnv);
      return [Action.None, { ...expr, a }];
    }
    case "binop": {
      let [s1, left] = annotateExpr(expr.left, globEnv, locEnv, topLevel);
      let [s2, right] = annotateExpr(expr.right, globEnv, locEnv, topLevel);
      let s = joinAction(s1, s2);
      if ((left.a === FAILEDINFER || right.a === FAILEDINFER)
      && !(left.a === FAILEDINFER && right.a === FAILEDINFER)) {
        switch (expr.op) {
          case BinOp.Plus: {
            let s_;
            if (left.a === FAILEDINFER) {
              [s_, left] = constrainExprType(left, right.a, globEnv, locEnv);
            } else {
              [s_, right] = constrainExprType(right, left.a, globEnv, locEnv);
            }
            s = joinAction(s, s_);
            break
          }
          case BinOp.Minus:
          case BinOp.Mul:
          case BinOp.IDiv:
          case BinOp.Mod:
          case BinOp.Gt:
          case BinOp.Gte:
          case BinOp.Lt:
          case BinOp.Lte: {
            let s_;
            if (left.a === FAILEDINFER) {
              [s_, left] = constrainExprType(left, NUM, globEnv, locEnv);
            } else {
              [s_, right] = constrainExprType(right, NUM, globEnv, locEnv);
            }
            s = joinAction(s, s_);
            break
          }
          case BinOp.Or:
          case BinOp.And: {
            let s_;
            if (left.a === FAILEDINFER) {
              [s_, left] = constrainExprType(left, BOOL, globEnv, locEnv);
            } else {
              [s_, right] = constrainExprType(right, BOOL, globEnv, locEnv);
            }
            s = joinAction(s, s_);
            break
          }
        }
      }
      const expr_: Expr<Type> = { tag: "binop", op: expr.op, left, right };
      const a = inferExprType(expr_, globEnv, locEnv);
      return [s, { ...expr_, a }];
    }
    case "uniop": {
      let [s, expr_] = annotateExpr(expr.expr, globEnv, locEnv, topLevel);
      if (expr_.a === FAILEDINFER) {
        switch (expr.op) {
          case UniOp.Neg: {
            let [s_, expr__] = constrainExprType(expr_, NUM, globEnv, locEnv);
            expr_ = expr__;
            s = joinAction(s, s_);
            break
          }
          case UniOp.Not: {
            let [s_, expr__] = constrainExprType(expr_, BOOL, globEnv, locEnv);
            expr_ = expr__;
            s = joinAction(s, s_);
            break
          }
        }
      }
      // if expr.expr is FAILEDINFER, we constrain its type by the concrete
      // unary operator being used
      const expr__: Expr<Type> = { tag: "uniop", op: expr.op, expr: expr_ };
      const a = inferExprType(expr__, globEnv, locEnv);
      return [s, { ...expr__, a }];
    }
    // TODO: think this over
    case "builtin1": {
      const [s, arg] = annotateExpr(expr.arg, globEnv, locEnv, topLevel);
      const expr_: Expr<Type> = { tag: "builtin1", name: expr.name, arg };
      const a = inferExprType(expr_, globEnv, locEnv);
      return [s, { ...expr_, arg , a }];
    }
    // TODO: think this over
    case "builtin2": {
      const [s1, left] = annotateExpr(expr.left, globEnv, locEnv, topLevel);
      const [s2, right] = annotateExpr(expr.right, globEnv, locEnv, topLevel);
      const expr_: Expr<Type> = { tag: "builtin2", name: expr.name, left, right };
      const a = inferExprType(expr_, globEnv, locEnv);
      return [joinAction(s1, s2), { ...expr_, left, right , a }];
    }
    case "call": {
      let s = Action.None;
      let arguments_ = [];
      // we try to annotate all the function arguments
      for (const arg of expr.arguments) {
        const [s_, arg_] = annotateExpr(arg, globEnv, locEnv, topLevel);
        s = joinAction(s, s_);
        arguments_.push(arg_);
      }

      // annotation fails if any supplied argument is UNSAT
      if (arguments_.some(arg => arg.a === UNSAT)) {
        return [Action.None, { ...expr, arguments: arguments_, a: UNSAT }];
      }


      if (globEnv.classes.has(expr.name)) {
        return [Action.None, { ...expr, a: CLASS(expr.name) }];
      }

      // we check with the inferred function map first since all changes the
      // algorithem makes to the function sigs go there
      // if (globEnv.inferred_functions.has(expr.name)) {
      //   let [inferredArgTypes, inferredRetType] = globEnv.inferred_functions.get(expr.name);
      //   let arguments__ = [];
      //   // we iterate through the annotated arguments. For any argument that the
      //   // algorithm annotated with a concrete type, we check that the result is
      //   // compatible with the correponding function argument type. If the
      //   // argument is FAILEDINFER, we look at the known argument types from the
      //   // function signature and impose that as a constraint on the argument.
      //   for (const [i, arg] of arguments_.entries()) {
      //     if (arg.a === FAILEDINFER) {
      //       const t_ = inferredArgTypes[i];
      //       // argument index out of bounds
      //       if (i > inferredArgTypes.length - 1) {
      //         return [Action.None, { ...expr, arguments: arguments_, a: UNSAT }];
      //       } else if (t_ === undefined || t_ === FAILEDINFER) {
      //         return [Action.None, { ...expr, arguments: arguments_, a: FAILEDINFER }];
      //       } else {
      //         const [s_, arg_] = constrainExprType(arg, t_, globEnv, locEnv);
      //         s = joinAction(s, s_);
      //         arguments__.push(arg_);
      //       }
      //     } else if (inferredArgTypes[i] === FAILEDINFER) {
      //       // If the argument is not FAILEDINFER, and if the function
      //       // signature's corresponding argument is FAILEDINFER, we update the
      //       // function signature with the inferred type
      //       inferredArgTypes[i] = arg.a;
      //       arguments__.push(arg);
      //     } else {
      //       arguments__.push(arg);
      //     }
      //   }
      //   globEnv.inferred_functions.set(expr.name, [inferredArgTypes, inferredRetType]);
      //   arguments_ = [...arguments__];
      // } else
      if (globEnv.functions.has(expr.name)) {
        const [argTypes, retType] = globEnv.functions.get(expr.name);
        let arguments__ = [];
        // If the function doesn't have inferred types, we first check that all
        // arguments aren't UNSAT
        if (argTypes.some(arg => arg === UNSAT)) {

          return [Action.None, { ...expr, arguments: arguments_, a: UNSAT }];

        } else if (argTypes.some(arg => arg === undefined)) {
          // If there are missing type annotations in the function parameter
          // list, we move the function signature from the function map to the
          // inferred_functions map and repeat. NOTE: this only takes care of
          // missing parameter types--constrainExprType takes care of missing
          // return types.


          // TODO: fill in the parameter types here


          //return annotateExpr(expr, globEnv, locEnv, topLevel);
        } else {
          for (const [i, arg] of arguments_.entries()) {
            // Argument index out of bounds
            if (i > argTypes.length - 1) {
              return [Action.None, { ...expr, arguments: arguments_, a: UNSAT}]
            } else if (arg.a === FAILEDINFER) {
              // At this stage, we know that the parameter list is complete with
              // user supplied type annotations. We use the type hints to fill in
              // FAILEDINFER's in our arguments
              const t_ = argTypes[i];
              const [s_, arg_] = constrainExprType(arg, t_, globEnv, locEnv);
              s = joinAction(s, s_);
              arguments__.push(arg_);
            } else if (!isSubtype(globEnv, arg.a, argTypes[i])) {
              // If we have a known type for the argument and that type isn't
              // compatible with the user supplied type hint, it is UNSAT
              return [Action.None, { ...expr, arguments: arguments_, a: UNSAT }];
            } else {
              arguments__.push(arg);
            }
          }
        }
      } else {
        // unknown function
        return [Action.None, { ...expr, arguments: arguments_, a: UNSAT }];
      }

      const expr_: Expr<Type> = { ...expr, arguments: arguments_, a: undefined };
      const a = inferExprType(expr_, globEnv, locEnv);
      return [s, { ...expr, arguments: arguments_, a }];
    }
    case "id": {
      const a = inferExprType(expr, globEnv, locEnv);
      return [Action.None, { ...expr, a }];
    }
    case "lookup": {
      const [s, obj] = annotateExpr(expr.obj, globEnv, locEnv, topLevel);
      const expr_: Expr<Type> = { ...expr, obj, a: undefined };
      const a = inferExprType(expr_, globEnv, locEnv);
      return [s, { ...expr, a, obj }];
    }
    // FIXME: need to port the logic from "call" over
    case "method-call": {
      let [s, obj] = annotateExpr(expr.obj, globEnv, locEnv, topLevel);
      let arguments_ = [];
      for (const arg of expr.arguments) {
        const [s_, arg_] = annotateExpr(arg, globEnv, locEnv, topLevel);
        s = joinAction(s, s_);
        arguments_.push(arg_);
      }
      const expr_: Expr<Type> = { ...expr, obj, arguments: arguments_, a: undefined };
      const a = inferExprType(expr_, globEnv, locEnv);
      return [s, { ...expr, obj, arguments: arguments_, a }];
    }
    case "construct": {
      const a = inferExprType(expr, globEnv, locEnv);
      return [Action.None, { ...expr, a }];
    }
    // FIXME: need to port the logic from "call" over
    case "lambda": {
      const [s, ret] = annotateExpr(expr.ret, globEnv, locEnv, topLevel);
      const expr_: Expr<Type> = { ...expr, ret, a: undefined };
      const a = inferExprType(expr_, globEnv, locEnv);
      return [s, { ...expr, a, ret }];
    }
    case "comprehension": {
      const [s1, expr_] = annotateExpr(expr.expr, globEnv, locEnv, topLevel);
      const [s2, iter] = annotateExpr(expr.iter, globEnv, locEnv, topLevel);
      let s = joinAction(s1, s2);
      let cond;
      if (expr.cond !== undefined) {
        let s_;
        [s_, cond] = annotateExpr(expr.cond, globEnv, locEnv, topLevel);
        s = joinAction(s, s_);
      }
      const expr__: Expr<Type> = { ...expr, expr: expr_, iter, cond, a: undefined };
      const a = inferExprType(expr__, globEnv, locEnv);
      return [s, { ...expr, a, expr: expr__, iter, cond }]
    }
    case "block": {
      let s = Action.None;
      let block = [];
      for (const stmt of expr.block) {
        const [s_, stmt_] = annotateStmt(stmt, globEnv, locEnv, topLevel);
        s = joinAction(s, s_);
        block.push(stmt_);
      }
      // const block = expr.block.map(s => annotateStmt(s, globEnv, locEnv, topLevel));
      const [s_, expr_] = annotateExpr(expr.expr, globEnv, locEnv, topLevel);
      const expr__: Expr<Type> = { ...expr, expr: expr_, block, a: undefined };
      const a = inferExprType(expr__, globEnv, locEnv);
      return [joinAction(s, s_), { ...expr, a, block, expr: expr_ }];
    }
    case "list-expr": {
      let s = Action.None;
      let contents = [];
      for (const e of expr.contents) {
        const [s_, e_] = annotateExpr(e, globEnv, locEnv, topLevel);
        s = joinAction(s_, s);
        contents.push(e_);
      }
      const expr_: Expr<Type> = { ...expr, contents, a: undefined };
      const a = inferExprType(expr_, globEnv, locEnv);
      return [s, { ...expr, a, contents }];
    }
    case "string_slicing": {
      const [s1, name] = annotateExpr(expr.name, globEnv, locEnv, topLevel);
      const [s2, start] = annotateExpr(expr.start, globEnv, locEnv, topLevel);
      const [s3, end] = annotateExpr(expr.end, globEnv, locEnv, topLevel);
      const [s4, stride] = annotateExpr(expr.stride, globEnv, locEnv, topLevel);
      const s = [s1, s2, s3, s4].reduce(joinAction, Action.None);
      const expr_: Expr<Type> = { ...expr, name, start, end, stride, a: undefined };
      const a = inferExprType(expr_, globEnv, locEnv);
      return [s, { ...expr, a, name, start, end, stride }];
    }
    case "dict": {
      let s = Action.None;
      let entries = [];
      for (const [key, val] of expr.entries) {
        const [s1, key_] = annotateExpr(key, globEnv, locEnv, topLevel);
        const [s2, val_] = annotateExpr(val, globEnv, locEnv, topLevel);
        const entry: [Expr<Type>, Expr<Type>] = [key, val];
        entries.push(entry);
        s = joinAction(s2, joinAction(s1, s));
      }
      const expr_: Expr<Type> = { ...expr, entries, a: undefined };
      const a = inferExprType(expr_, globEnv, locEnv);
      return [s, { ...expr, a, entries }];
    }
    case "bracket-lookup": {
      const [s1, obj] = annotateExpr(expr.obj, globEnv, locEnv, topLevel);
      const [s2, key] = annotateExpr(expr.key, globEnv, locEnv, topLevel);
      const s = joinAction(s1, s2);
      const expr_: Expr<Type> = { ...expr, obj, key, a: undefined };
      const a = inferExprType(expr_, globEnv, locEnv);
      return [s, { ...expr, a, obj, key }];
    }
  }
}

// For now this doesn't work with globals--all variables must be defined in the
// current scope
export function annotateStmt(
  stmt: Stmt<any>,
  globEnv: GlobalTypeEnv,
  locEnv: LocalTypeEnv,
  topLevel: boolean
): [Action, Stmt<Type>] {
  switch (stmt.tag) {
    case "assign": {
      if (topLevel && globEnv.globals.has(stmt.name)) {
        const type_ = globEnv.globals.get(stmt.name);
        const [s1, value] = annotateExpr(stmt.value, globEnv, locEnv, topLevel);
        const [s2, value_] = constrainExprType(value, type_, globEnv, locEnv);
        return [joinAction(s1, s2), { ...stmt, a: NONE, value: value_ }]
      } else {
        const [s, value] = annotateExpr(stmt.value, globEnv, locEnv, topLevel);
        //let a = value.a; // Shouldn't this always be type None? The type of `x = 0`?
        let a = NONE  // TODO: make sure algorithm doesn't expect anything other than this.
        if (locEnv.vars.has(stmt.name)) {
          let type_ = locEnv.vars.get(stmt.name);
          // FIXME: make isSubtype work with LocalTypeEnv since this is a local
          // variable we are talking about
          if (type_ === FAILEDINFER) {
            locEnv.vars.set(stmt.name, a);
          } else {
            if (!isSubtype(globEnv, a, type_)) {
              a = UNSAT;
            }
          }
        } else {
          locEnv.vars.set(stmt.name, a);
        }
        return [s, { ...stmt, a, value }];
      }
    }
    // TODO: For now we only infer the type of the return value by the RHS.
    // We might need to restructure part of the code to get it to infer the type
    // of the returned value from the call site
    case "return": {
      const [s, value] = annotateExpr(stmt.value, globEnv, locEnv, topLevel);
      let a = value.a;
      return [s, { ...stmt, a, value }];
    }
    case "expr": {
      const [s, expr] = annotateExpr(stmt.expr, globEnv, locEnv, topLevel);
      const a = expr.a;
      return [s, { tag: "expr", a, expr }];
    }
    // TODO: the tricky part. will do later
    case "if": {
      let s = Action.None;
      let thn_ = []
      for (const st of stmt.thn) {
        const [s_, stmt_] = annotateStmt(st, globEnv, locEnv, topLevel);
        s = joinAction(s, s_);
        thn_.push(stmt_);
      };

      let els_ = []
      for (const st of stmt.els) {
        const [s_, stmt_] = annotateStmt(st, globEnv, locEnv, topLevel);
        s = joinAction(s, s_);
        els_.push(stmt_);
      };;
      return [s, { ...stmt, a: NONE, thn: thn_, els: els_ }];
    }

    case "while": {
      let s = Action.None;
      let body_ = []
      for (const st of stmt.body) {
        const [s_, stmt_] = annotateStmt(st, globEnv, locEnv, topLevel);
        s = joinAction(s, s_);
        body_.push(stmt_);
      };
      return [s, { ...stmt, a: NONE, body: body_ }];
    }

    // FIXME: how about the case where multiple classes have fields that share
      // the same name with different types?
    case "field-assign": {
      const [s1, value] = annotateExpr(stmt.value, globEnv, locEnv, topLevel);
      const [s2, obj] = annotateExpr(stmt.obj, globEnv, locEnv, topLevel);
      const s = joinAction(s1, s2);
      let a: Type;
      if (obj.a === FAILEDINFER && !topLevel && value.a !== UNSAT) {  // in a function body
        let classes = []
        for (const [key, [fields, _]] of globEnv.classes.entries()) {
          if (fields.has(stmt.field)) {
            if (fields.get(stmt.field).tag === value.a.tag) {
              classes.push(CLASS(key))
            }
          }
        }
        if (classes.length == 1) {
          const [s, obj] = constrainExprType(stmt.obj, classes[0], globEnv, locEnv);
          if (obj.a === UNSAT) {
            return [Action.None, { ...stmt, obj, a: UNSAT }];
          } else {
            return [s, { ...stmt, a: stmt.a, obj, value }];
          }
        } else if (classes.length == 0) {
          return [Action.None, { ...stmt, a: UNSAT }]
        } else {
          return [Action.None, { ...stmt, a: FAILEDINFER }]
        }
      } else if (obj.a === UNSAT
               || value.a === UNSAT
               || obj.a.tag != "class"
               || !globEnv.classes.has(obj.a.name)  // if class map contains the class
               || !globEnv.classes.get(obj.a.name)[0].has(stmt.field) // if the class contains the field
               || !isSubtype(globEnv, value.a, globEnv.classes.get(obj.a.name)[0].get(stmt.field))) {
        a = UNSAT;
      } else {
        a = globEnv.classes.get(obj.a.name)[0].get(stmt.field);
      }
      // TODO: not entirely sure if this is the way to determine a
      return [s, { ...stmt, a, obj, value }];
    }

    case "for": {
      let index;
      let s = Action.None;
      if (stmt.index !== undefined) {
        const [s_, index_] = annotateExpr(stmt.index, globEnv, locEnv, topLevel);
        s = s_;
        index = index_;
      }
      const [s2, iterable] = annotateExpr(stmt.iterable, globEnv, locEnv, topLevel);
      s = joinAction(s, s2);
      let body = [];
      for (const st of stmt.body) {
        let [s_, st_] = annotateStmt(st, globEnv, locEnv, topLevel);
        s = joinAction(s, s_);
        body.push(st_);
      }
      // TODO: not entirely sure about the value of a
      const a = iterable.a;
      return [s, { ...stmt, a, iterable, body, index }];
    }
    // FIXME: what the hell is bracket-assign?
    // case "bracket-assign" {
    // }
    case "pass":
    case "continue":
    case "break":
      return [Action.None, stmt]
    default:
      throw new Error(`Type annotation is not implemented for the following statement: ${stmt.tag}`);
  }
}




// Invariant: When this algorithm terminates, there should be *no* undefined type tags *anywhere* in the
// entire program tree.
export function annotateAST(globEnv: GlobalTypeEnv, program: Program<null>): [GlobalTypeEnv, Program<Type>] {

  // gather any type information that the user provided
  const locEnv = emptyLocalTypeEnv();
  const newEnv = augmentTEnv(globEnv, program)

  // we now infer types of the program statement by statement
  let s = Action.None;
  let stmts = []
  // repeatedly call the inference algorithm until the flag is marked converged
  do {
    let stmts_ = [];
    for (const stmt of program.stmts) {
      const [s_, stmt_] = annotateStmt(stmt, newEnv, locEnv, true);
      s = joinAction(s, s_);
      stmts_.push(stmt_);
    }
    stmts = [...stmts_];
  } while (s == Action.Repeat);

  // for (const st of stmts) {
  //   if (st.a.tag === "open-object") {
  //     closeOpenTypes(newEnv, st);
  //   }
  // }

  for (const [name, [argTypes, retType]] of newEnv.functions.entries()) {
    for (var fundef of program.funs) {
      if (fundef.name === name) {
        for (const [i, argType] of argTypes.entries()) {
          fundef.parameters[i].type = argType;
        }
        fundef.ret = retType;
      }
    }
  }

  // for (const [name, [fields, methods]] of newEnv.classes.entries()) {
  // }

  return [newEnv, { ...program, stmts }]
}

// function closeOpenTypes(globEnv: GlobalTypeEnv, st: Stmt<Type>) {
//   for (const c of globEnv.classes.keys()) {
//     switch (st.tag) {
//       case "assign":
//         if (isSubtype(globEnv, CLASS(c), st.value.a)) {
//           st.value.a = CLASS(c);
//           return;
//         }
//         break;
//       default:
//         throw new Error(`TODO implement closing types for '${st.tag}'`)
//     }
//   }
// }

