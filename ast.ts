// -*- mode: typescript; typescript-indent-level: 2; -*-

export type Parameter = { tag: "parameter", name: string, type: Type }
export type Pos = { line: number, col: number, len: number } // For line information on error
export type Branch = { tag: "branch", cond: Expr, condPos: Pos, body : Array<Stmt> }

export type Value =
    { tag: "none" }
  | { tag: "bool", value: boolean }
  | { tag: "num", value: number }
  | { tag: "object", name: string, address: number}
  | { tag: "str", off: number }
  | { tag: "char", off: number } // Internal character representation

export type Type =
  | {tag: "number"}
  | {tag: "bool"}
  | {tag: "none"}
  | {tag: "str"}
  | {tag: "class", name: string}

export const BoolT:  Type = { tag: "bool" };
export const IntT:   Type = { tag: "number" };
export const NoneT:  Type = { tag: "none" };
export const StrT:   Type = { tag: "str" };
export const ClassT: Type = { tag: "class", name: undefined };

export type Name = { str: string, pos: Pos }
export type ClassBody = { iVars: Array<Stmt>, inherits: Array<Name>,  funcs: Array<Function> };
export type Function = { pos: Pos, name: Name, parametersPos: Pos, parameters: Array<Parameter>, ret: Type, retPos: Pos, body: Array<Stmt> };

export type Stmt =
  | { tag: "comment", pos: Pos }
  | { tag: "break", pos: Pos} 
  | { tag: "pass", pos: Pos }
  | { tag: "func", content: Function }
  | { tag: "define", pos: Pos, name: Name, staticType: Type, value: Expr }
  | { tag: "assign", pos: Pos, lhs: Expr, value: Expr, staticType?: Type }
  | { tag: "expr", expr: Expr }
  | { tag: "while", cond: Expr, whileBody: Array<Stmt> }
  | { tag: "if", cond: Expr, condPos: Pos, ifBody: Array<Stmt>, branches: Array<Branch>, elseBody: Array<Stmt> }
  | { tag: "return", pos: Pos, expr: Expr }
  | { tag: "class", name: Name, body: ClassBody }
  | { tag: "for", varName: Name, str: Expr, body: Array<Stmt> }

export type Expr =
  | { iType?: Type, tag: "nop", pos: Pos }
  | { iType?: Type, tag: "intervalExp", pos: Pos, expr: Expr, args: Expr[] }
  | { iType?: Type, tag: "num", pos: Pos, value: number }
  | { iType?: Type, tag: "self", pos: Pos }
  | { iType?: Type, tag: "none", pos: Pos}
  | { iType?: Type, tag: "bool", pos: Pos, value: boolean}
  | { iType?: Type, tag: "id", pos: Pos, name: string }
  | { iType?: Type, tag: "memExp", pos: Pos, expr: Expr, member: Name }
  | { iType?: Type, tag: "binExp", pos: Pos, name: string, arg: [Expr, Expr] }
  | { iType?: Type, tag: "unaryExp", pos: Pos, name: string, arg: Expr }
  | { iType?: Type, tag: "funcCall", pos: Pos, prmPos: Pos, prmsPosArr: Array<Pos>, name: Expr, args: Array<Expr> }
  | { iType?: Type, tag: "string", pos: Pos, value: string }
