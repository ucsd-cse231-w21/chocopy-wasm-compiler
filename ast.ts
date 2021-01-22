// import { TypeCheckError } from "./type-check";

export type Type =
    { tag: "num" }
  | { tag: "bool" }
  | { tag: "none" }
  | { tag: "object" }

export const NUM : {tag: "num"} = {tag: "num"};
export const BOOL : {tag: "bool"} = {tag: "bool"};
export const NONE : {tag: "none"} = {tag: "none"};
export const OBJ : {tag: "object"} = {tag: "object"};

export type Parameter = { name: string, type: Type }

export type Program = { funs: Array<FunDef>, inits: Array<VarInit>, stmts: Array<Stmt> }

export type VarInit = { name: string, type: Type, value: Literal }

export type FunDef = { name: string, parameters: Array<Parameter>, ret: Type, inits: Array<VarInit>, body: Array<Stmt> }

export type Stmt =
  | { tag: "assign", name: string, value: Expr }
  | { tag: "return", value: Expr }
  | { tag: "expr", expr: Expr }
  | { tag: "if", cond: Expr, thn: Array<Stmt>, els: Array<Stmt> }

export type Expr =
    { tag: "literal", value: Literal }
  | { tag: "id", name: string }
  | { tag: "op", op: Op, left: Expr, right: Expr}
  | { tag: "builtin1", name: string, arg: Expr }
  | { tag: "builtin2", name: string, left: Expr, right: Expr}
  | { tag: "call", name: string, arguments: Array<Expr> } 

export type Literal = 
    { tag: "num", value: number }
  | { tag: "bool", value: boolean }

// TODO: should we split up arithmetic ops from bool ops?
export enum Op { Plus, Minus, Mul, And, Or};
