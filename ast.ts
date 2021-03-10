// import { TypeCheckError } from "./type-check";

import { type } from "cypress/types/jquery";
import { ClassPresenter, FuncIdentity, ModulePresenter } from "./types";

// export enum Type {NUM, BOOL, NONE, OBJ};
export type Type =
  | { tag: "number" }
  | { tag: "bool" }
  | { tag: "none" }
  | { tag: "string" }
  | { tag: "class"; name: string }
  | { tag: "callable"; args: Array<Type>; ret: Type }
  | { tag: "list"; content_type: Type };

/**
 * Checks if two types are strictly equal. 
 * There is no accouting for inheritance.
 * @param a - one of the Types to check for equality
 * @param b - one of the Types to check for equality
 * 
 * @returns true if a and b are strictly equal. Else, false
 */
export function isSameType(a: Type, b: Type) : boolean {
  if(a.tag === b.tag){
    if(a.tag === "class" && b.tag === "class"){
      return a.name === b.name;
    }
    else if(a.tag === "list" && b.tag === "list"){
      return isSameType(a.content_type, b.content_type);
    }
    else if(a.tag === "callable" && b.tag === "callable"){
      if(a.args.length === b.args.length && isSameType(a.ret, b.ret)){
        for(let i = 0; i < a.args.length; i++){
          if(!isSameType(a.args[i], b.args[i])){
            return false;
          }
        }
      }
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Returns the string representation of a Type.
 * Callable types are formatted as such:
 *      "(" <parameterType> "," <parameterType> ... ") -> " <returnType> 
 * 
 * @param type - the Type to generate a string representation of
 * @returns the string representation of the provided Type
 */
export function typeToString(type: Type) : string {
  switch(type.tag){
    case "class": return type.name;
    case "list":  return `[${typeToString(type.content_type)}]`;
    case "callable": return `(${type.args.map(x => typeToString(x)).join(",")}) -> ${typeToString(type.ret)}`;
    default: return type.tag;
  }
}

/**
 * An organized representation of a ChocoPy program
 */
/*
export type OrganizedProgram<A> = {
  annotation? : A,
  moduleFuncs: Map<string, FunDef<A>>,
  moduleClasses: Map<string, Class<A>>,
  moduleVariables: Map<string, VarInit<A>>,
  stmts: Array<Stmt<A>>
}
*/

export type Program<A> = {
  funcs: Map<string, FunDef<A>>;
  inits: Map<string, VarInit<A>>;
  classes: Map<string, Class<A>>;
  stmts: Array<Stmt<A>>;
  presenter? : ModulePresenter;
};

export type Class<A> = {
  a?: A;
  name: string;
  fields: Map<string, VarInit<A>>;
  methods: Map<string, FunDef<A>>;
  presenter? : ClassPresenter;
};

export type VarInit<A> = { a?: A; name: string; type: Type; value: Literal };

export type FunDef<A> = {
  a?: A;
  identity: FuncIdentity;
  parameters: Map<string, Type>;
  localVars: Map<string, VarInit<A>>;
  body: Array<Stmt<A>>;
};

export type CallSite = {
  iden: FuncIdentity,
  module: string, //if module if undefined, assume it's the source module
  isConstructor: boolean
}

export type Stmt<A> =
  | { a?: A; tag: "class"; def: Class<A>}
  | { a?: A; tag: "vardec"; def: VarInit<A>}
  | { a?: A; tag: "func"; def: FunDef<A>}
  | { a?: A, tag: "import", isFromStmt:boolean, target: string, compName?: Array<string>, alias?: string}

  | { a?: A; tag: "assign"; name: string; value: Expr<A> }
  | { a?: A; tag: "return"; value: Expr<A> }
  | { a?: A; tag: "expr"; expr: Expr<A> }
  | { a?: A; tag: "if"; cond: Expr<A>; thn: Array<Stmt<A>>; els: Array<Stmt<A>> }
  | { a?: A; tag: "pass" }
  | { a?: A; tag: "field-assign"; obj: Expr<A>; field: string; value: Expr<A> }
  | { a?: A; tag: "while"; cond: Expr<A>; body: Array<Stmt<A>> }
  | { a?: A; tag: "assignment"; target: Destructure<A>; value: Expr<A> } //unsupported for builtins at the moment
  | { a?: A; tag: "continue" } //unsupported for builtins at the moment
  | { a?: A; tag: "break" } //unsupported for builtins at the moment
  | { a?: A; tag: "for"; name: string; index?: Expr<A>; iterable: Expr<A>; body: Array<Stmt<A>> } //unsupported for builtins at the moment
  | { a?: A; tag: "bracket-assign"; obj: Expr<A>; key: Expr<A>; value: Expr<A> } //unsupported for builtins at the moment


export interface Destructure<A> {
  isDestructured: boolean;
  targets: AssignTarget<A>[];
}

export interface AssignTarget<A> {
  target: Assignable<A>;
  starred: boolean;
  ignore: boolean;
}

// List of tags in Assignable. unfortunately, TS can't generate a JS array from a type,
// so we instead must explicitly declare one.
export const ASSIGNABLE_TAGS = ["id", "lookup"] as const;
/**
 * Subset of Expr types which are valid as assign targets
 */
export type Assignable<A> =
  | { a?: A; tag: "id"; name: string }
  | { a?: A; tag: "lookup"; obj: Expr<A>; field: string };

export type Expr<A> =
  | { a?: A; tag: "literal"; value: Literal }
  | { a?: A; tag: "binop"; op: BinOp; left: Expr<A>; right: Expr<A> }
  | { a?: A; tag: "uniop"; op: UniOp; expr: Expr<A> }
  | { a?: A; tag: "call"; name: string; arguments: Array<Expr<A>>, callSite?: CallSite }
  | { a?: A; tag: "nestedexpr"; expr: Expr<A> }
  // ASSIGNABLE EXPRS
  | { a?: A; tag: "id"; name: string }
  | { a?: A; tag: "lookup"; obj: Expr<A>; field: string }
  // END ASSIGNABLE EXPRS
  | { a?: A; tag: "list-expr"; contents: Array<Expr<A>> } 
  | { a?: A; tag: "method-call"; obj: Expr<A>; method: string; arguments: Array<Expr<A>>, callSite?: CallSite  }

  | { a?: A; tag: "construct"; name: string } //unsupported for builtins at the moment
  | { a?: A; tag: "lambda"; args: Array<string>; ret: Expr<A> } //unsupported for builtins at the moment
  | { a?: A; tag: "comprehension"; expr: Expr<A>; field: string; iter: Expr<A>; cond?: Expr<A> } //unsupported for builtins at the moment
  | { a?: A; tag: "block"; block: Array<Stmt<A>>; expr: Expr<A> } //unsupported for builtins at the moment
  | { a?: A; tag: "string_slicing"; name: Expr<A>; start: Expr<A>; end: Expr<A>; stride: Expr<A> } //unsupported for builtins at the moment
  | { a?: A; tag: "dict"; entries: Array<[Expr<A>, Expr<A>]> } //unsupported for builtins at the moment
  | { a?: A; tag: "bracket-lookup"; obj: Expr<A>; key: Expr<A> }; //unsupported for builtins at the moment

// TODO: should we split up arithmetic ops from bool ops?
export enum BinOp {
  Plus = "+",
  Minus = "-",
  Mul = "*",
  IDiv = "//",
  Mod = "%",
  Eq = "==",
  Neq = "!=",
  Lte = "<=",
  Gte = ">=",
  Lt = "<",
  Gt = ">",
  Is = "is",
  And = "and",
  Or = "or",
}

export enum UniOp {
  Neg = "-",
  Not = "not",
}

export type Value =
  | Literal
  | { tag: "object"; address: number };
  //| { tag: "callable"; name: string; address: number };

export type Literal =
  | { tag: "num"; value: bigint }
  | { tag: "bool"; value: boolean }
  | { tag: "string"; value: string }
  | { tag: "none" };

export type Location = { line: number; col: number; length: number };
