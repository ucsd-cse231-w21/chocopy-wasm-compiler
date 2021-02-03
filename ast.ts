// import { TypeCheckError } from "./type-check";

// export enum Type {NUM, BOOL, NONE, OBJ}; 
export const NUM : {tag: "number"} = {tag: "number"};
export const BOOL : {tag: "bool"} = {tag: "bool"};
export const NONE : {tag: "none"} = {tag: "none"};
export function CLASS(name : string) : Type {return {tag: "class", name}};
export type Type =
  | {tag: "number"}
  | {tag: "bool"}
  | {tag: "none"}
  | {tag: "class", name: string}

export type Parameter = { name: string, type: Type }

export type Program = { funs: Array<FunDef>, inits: Array<VarInit>, classes: Array<Class>, stmts: Array<Stmt> }

export type Class = {name: string, fields: Array<VarInit>, methods: Array<FunDef>}

export type VarInit = { name: string, type: Type, value: Literal }

export type FunDef = { name: string, parameters: Array<Parameter>, ret: Type, inits: Array<VarInit>, body: Array<Stmt> }

export type Stmt =
  | { tag: "assign", name: string, value: Expr }
  | { tag: "return", value: Expr }
  | { tag: "expr", expr: Expr }
  | { tag: "if", cond: Expr, thn: Array<Stmt>, els: Array<Stmt> }
  | { tag: "while", cond: Expr, body: Array<Stmt> }
  | { tag: "pass" }

export type Expr =
    { tag: "literal", value: Literal }
  | { tag: "id", name: string }
  | { tag: "binop", op: BinOp, left: Expr, right: Expr}
  | { tag: "uniop", op: UniOp, expr: Expr }
  | { tag: "builtin1", name: string, arg: Expr }
  | { tag: "builtin2", name: string, left: Expr, right: Expr}
  | { tag: "call", name: string, arguments: Array<Expr> } 

export type Literal = 
    { tag: "num", value: number }
  | { tag: "bool", value: boolean }

// TODO: should we split up arithmetic ops from bool ops?
export enum BinOp { Plus, Minus, Mul, IDiv, Mod, Eq, Neq, Lte, Gte, Lt, Gt, Is, And, Or};

export enum UniOp { Neg, Not };
