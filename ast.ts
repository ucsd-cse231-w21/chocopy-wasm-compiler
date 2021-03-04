// import { TypeCheckError } from "./type-check";

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

export type Scope<A> =
  | { a?: A; tag: "global"; name: string } // not support
  | { a?: A; tag: "nonlocal"; name: string };

export type Parameter<A> = { name: string; type: Type; value?: Literal };

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
  a?: A;
  funs: Array<FunDef<A>>;
  inits: Array<VarInit<A>>;
  classes: Array<Class<A>>;
  stmts: Array<Stmt<A>>;
};

export type Class<A> = {
  a?: A;
  name: string;
  fields: Array<VarInit<A>>;
  methods: Array<FunDef<A>>;
};

export type VarInit<A> = { a?: A; name: string; type: Type; value: Literal };

export type FunDef<A> = {
  a?: A;
  name: string;
  parameters: Array<Parameter<A>>;
  ret: Type;
  decls: Array<Scope<A>>;
  inits: Array<VarInit<A>>;
  funs: Array<FunDef<A>>;
  body: Array<Stmt<A>>;
};

export type Closure<A> = {
  a?: A;
  name: string;
  fields: Array<VarInit<A>>;
  apply: FunDef<A>;
};

export type Stmt<A> =
  | { a?: A; tag: "assignment"; target: Destructure<A>; value: Expr<A> } // TODO: unify field assignment with destructuring. This will eventually replace tag: "id-assign"
  | { a?: A; tag: "assign"; name: string; value: Expr<A> }
  | { a?: A; tag: "return"; value: Expr<A> }
  | { a?: A; tag: "expr"; expr: Expr<A> }
  | { a?: A; tag: "if"; cond: Expr<A>; thn: Array<Stmt<A>>; els: Array<Stmt<A>> }
  | { a?: A; tag: "while"; cond: Expr<A>; body: Array<Stmt<A>> }
  | { a?: A; tag: "pass" }
  | { a?: A; tag: "field-assign"; obj: Expr<A>; field: string; value: Expr<A> }
  | { a?: A; tag: "continue" }
  | { a?: A; tag: "break" }
  | { a?: A; tag: "for"; name: string; index?: Expr<A>; iterable: Expr<A>; body: Array<Stmt<A>> }
  | { a?: A; tag: "bracket-assign"; obj: Expr<A>; key: Expr<A>; value: Expr<A> }
  | {  a?: A, tag: "import", isFromStmt:boolean, target: string, compName?: Array<string>, alias?: string};


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
  | { a?: A; tag: "builtin1"; name: string; arg: Expr<A> }
  | { a?: A; tag: "builtin2"; name: string; left: Expr<A>; right: Expr<A> }
  | { a?: A; tag: "call"; name: string; arguments: Array<Expr<A>> }
  // ASSIGNABLE EXPRS
  | { a?: A; tag: "id"; name: string }
  | { a?: A; tag: "lookup"; obj: Expr<A>; field: string }
  // END ASSIGNABLE EXPRS
  | { a?: A; tag: "method-call"; obj: Expr<A>; method: string; arguments: Array<Expr<A>> }
  | { a?: A; tag: "construct"; name: string }
  | { a?: A; tag: "lambda"; args: Array<string>; ret: Expr<A> }
  | { a?: A; tag: "comprehension"; expr: Expr<A>; field: string; iter: Expr<A>; cond?: Expr<A> }
  | { a?: A; tag: "block"; block: Array<Stmt<A>>; expr: Expr<A> }
  | { a?: A; tag: "list-expr"; contents: Array<Expr<A>> }
  | { a?: A; tag: "string_slicing"; name: Expr<A>; start: Expr<A>; end: Expr<A>; stride: Expr<A> }
  | { a?: A; tag: "dict"; entries: Array<[Expr<A>, Expr<A>]> }
  | { a?: A; tag: "bracket-lookup"; obj: Expr<A>; key: Expr<A> };

export type Literal =
  | { tag: "num"; value: bigint }
  | { tag: "bool"; value: boolean }
  | { tag: "string"; value: string }
  | { tag: "none" };

// TODO: should we split up arithmetic ops from bool ops?
export enum BinOp {
  Plus,
  Minus,
  Mul,
  IDiv,
  Mod,
  Eq,
  Neq,
  Lte,
  Gte,
  Lt,
  Gt,
  Is,
  And,
  Or,
}

export enum UniOp {
  Neg,
  Not,
}

export type Value =
  | Literal
  | { tag: "object"; name: string; address: number }
  | { tag: "callable"; name: string; address: number };

export type Location = { line: number; col: number; length: number };
