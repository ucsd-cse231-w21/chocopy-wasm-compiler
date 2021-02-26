// import { TypeCheckError } from "./type-check";

// export enum Type {NUM, BOOL, NONE, OBJ}; 
export type Type =
  | {tag: "number"}
  | {tag: "bool"}
  | {tag: "none"}
  | {tag: "class", name: string}
  | {tag: "callable", args: Array<Type>, ret: Type}

export type Scope<A> = 
  | { a?: A, tag: "global", name: string} // not support
  | { a?: A, tag: "nonlocal", name: string}

export type Parameter<A> = { name: string, type: Type, value?: Literal }

export type Program<A> = { a?: A, funs: Array<FunDef<A>>, inits: Array<VarInit<A>>, classes: Array<Class<A>>, stmts: Array<Stmt<A>> }

export type Class<A> = { a?: A, name: string, fields: Array<VarInit<A>>, methods: Array<FunDef<A>>}

export type VarInit<A> = { a?: A, name: string, type: Type, value: Literal }

export type FunDef<A> = { 
  a?: A, 
  name: string, 
  parameters: Array<Parameter<A>>, 
  ret: Type, 
  decls: Array<Scope<A>>,
  inits: Array<VarInit<A>>, 
  funs: Array<FunDef<A>>
  body: Array<Stmt<A>>
}

export type Closure<A> = { 
  a?: A, 
  name: string, 
  fields: Array<VarInit<A>>, 
  apply: FunDef<A> 
}

export type Stmt<A> =
  | {  a?: A, tag: "assign", name: string, value: Expr<A> }
  | {  a?: A, tag: "return", value: Expr<A> }
  | {  a?: A, tag: "expr", expr: Expr<A> }
  | {  a?: A, tag: "if", cond: Expr<A>, thn: Array<Stmt<A>>, els: Array<Stmt<A>> }
  | {  a?: A, tag: "while", cond: Expr<A>, body: Array<Stmt<A>> }
  | {  a?: A, tag: "pass" }
  | {  a?: A, tag: "field-assign", obj: Expr<A>, field: string, value: Expr<A> }
  | {  a?: A, tag: "continue" }
  | {  a?: A, tag: "break" }
  | {  a?: A, tag: "for", name: string, index?: Expr<A>, iterable: Expr<A>, body: Array<Stmt<A>> }

export type Expr<A> =
    {  a?: A, tag: "literal", value: Literal }
  | {  a?: A, tag: "id", name: string }
  | {  a?: A, tag: "binop", op: BinOp, left: Expr<A>, right: Expr<A>}
  | {  a?: A, tag: "uniop", op: UniOp, expr: Expr<A> }
  | {  a?: A, tag: "builtin1", name: string, arg: Expr<A> }
  | {  a?: A, tag: "builtin2", name: string, left: Expr<A>, right: Expr<A>}
  | {  a?: A, tag: "call", name: string, arguments: Array<Expr<A>> } 
  | {  a?: A, tag: "lookup", obj: Expr<A>, field: string }
  | {  a?: A, tag: "method-call", obj: Expr<A>, method: string, arguments: Array<Expr<A>> }
  | {  a?: A, tag: "construct", name: string }
  | {  a?: A, tag: "lambda", args: Array<string>, ret: Expr<A> }
  | {  a?: A, tag: "comprehension", expr: Expr<A>, field: string, iter: Expr<A>, cond?: Expr<A> }
  | {  a?: A, tag: "block", block: Array<Stmt<A>>, expr: Expr<A> }

export type Literal = 
    { tag: "num", value: BigInt }
  | { tag: "bool", value: boolean }
  | { tag: "none" }

// TODO: should we split up arithmetic ops from bool ops?
export enum BinOp { Plus, Minus, Mul, IDiv, Mod, Eq, Neq, Lte, Gte, Lt, Gt, Is, And, Or};

export enum UniOp { Neg, Not };

export type Value =
    Literal
  | { tag: "object", name: string, address: number}
  | { tag: "callable", name: string, address: number}

export type Location = { line : number, col : number, length : number }
