
export type Parameter = { name: string }

export type Stmt =
  | { tag: "define", name: string, value: Expr }
  | { tag: "fun", name: string, parameters: Array<Parameter>, body: Array<Stmt> }
  | { tag: "return", value: Expr }
  | { tag: "expr", expr: Expr }
  | { tag: "if", cond: Expr, thn: Array<Stmt>, els: Array<Stmt> }

export type Expr =
    { tag: "num", value: number }
  | { tag: "bool", value: boolean }
  | { tag: "id", name: string }
  | { tag: "op", op: Op, left: Expr, right: Expr}
  | { tag: "builtin1", name: string, arg: Expr }
  | { tag: "builtin2", name: string, left: Expr, right: Expr}
  | { tag: "call", name: string, arguments: Array<Expr> } 

// TODO: should we split up arithmetic ops from bool ops?
export enum Op { Plus, Minus, Mul, And, Or};
