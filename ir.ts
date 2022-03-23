import {Type, BinOp, UniOp, Parameter} from './ast';

export type Program<A> = { a?: A, funs: Array<FunDef<A>>, inits: Array<VarInit<A>>, classes: Array<Class<A>>, stmts: Array<Stmt<A>> }

export type Class<A> = { a?: A, name: string, fields: Array<VarInit<A>>, methods: Array<FunDef<A>>}

export type VarInit<A> = { a?: A, name: string, type: Type, value: Value<A> }

export type FunDef<A> = { a?: A, name: string, parameters: Array<Parameter<A>>, ret: Type, inits: Array<VarInit<A>>, body: Array<Stmt<A>> }

export type Stmt<A> =
  | {  a?: A, tag: "label", name: string }
  | {  a?: A, tag: "ifjmp", cond: Expr<A>, thn: string, els: string }
  | {  a?: A, tag: "jmp", lbl: string }
  | {  a?: A, tag: "assign", name: string, value: Expr<A> }
  | {  a?: A, tag: "return", value: Value<A> }
  | {  a?: A, tag: "field-assign", obj: Value<A>, field: string, value: Value<A> }
  | {  a?: A, tag: "pass" }
  | {  a?: A, tag: "expr", expr: Expr<A> }

export type Expr<A> =
  | {  a?: A, tag: "binop", op: BinOp, left: Value<A>, right: Value<A>}
  | {  a?: A, tag: "uniop", op: UniOp, expr: Value<A> }
  | {  a?: A, tag: "builtin1", name: string, arg: Value<A> }
  | {  a?: A, tag: "builtin2", name: string, left: Value<A>, right: Value<A>}
  | {  a?: A, tag: "call", name: string, arguments: Array<Value<A>> } 
  | {  a?: A, tag: "lookup", obj: Value<A>, field: string }
  | {  a?: A, tag: "method-call", obj: Value<A>, method: string, arguments: Array<Value<A>> }
  | {  a?: A, tag: "construct", name: string }
  | {  a?: A, tag: "value", value: Value<A> }

export type Value<A> = 
    { a?: A, tag: "num", value: bigint }
  | { a?: A, tag: "bool", value: boolean }
  | { a?: A, tag: "id", name: string }
  | { a?: A, tag: "none" }