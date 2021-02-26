import { SyntaxNode } from "lezer-tree"

export type Program = {
  defs: PreDef,
  stmts: Array<Stmt>
}

export type PreDef = {
  varDefs: Array<VarDef>,
  funcDefs: Array<FuncDef>,
  classDefs: Array<ClassDef>,
}

export type VarDef = { tvar: TypedVar, value: Literal }
export type TypeStr = string
export type TypedVar = { name: VarName, type: TypeStr }

export type FuncDef = {
  name: VarName,
  params: Array<TypedVar>,
  retType: TypeStr,
  body: FuncBody,
}

export type ClassDef = {
  name: VarName,
  parent: VarName,
  defs: PreDef,
}

export type FuncBody = {
  defs: PreDef,
  stmts: Array<Stmt>
}

export type Stmt =
  { cursor: SyntaxNode, type: ClassType } &
  (
    { tag: "assign", name: Expr, value: Expr }
    | { tag: "if", exprs: Array<Expr>, blocks: Array<Array<Stmt>> }
    | { tag: "while", expr: Expr, stmts: Array<Stmt> }
    | { tag: "pass" }
    | { tag: "return", expr: Expr }
    | { tag: "expr", expr: Expr }
    | { tag: "print", expr: Expr }
  )

export type Expr =
  { cursor: SyntaxNode, type: ClassType } &
  (
    { tag: "literal", value: Literal }
    | { tag: "id", name: VarName, funcType: FuncType, classType: ClassType }
    | { tag: "binaryop", expr1: Expr, expr2: Expr, op: Op }
    | { tag: "unaryop", expr: Expr, op: Op }
    | { tag: "call", caller: Expr, args: Array<Expr> }
    | { tag: "member", owner: Expr, property: VarName, funcType: FuncType, classType: ClassType }  // e.g.: x.y.z -> name: x.y, property: z, z can be function
  )

export type VarName = string
export type Op = string

export type Literal =
  { tag: "None" }
  | { tag: "True" }
  | { tag: "False" }
  | { tag: "number", value: number }

export class Variable {
  name: VarName;
  type: ClassType;
  value: Literal;
  offset: number;
}

export class FuncType {
  globalName: string;
  paramsType: Array<ClassType>;
  returnType: ClassType;
  isMemberFunc: boolean;

  constructor(globalName: string, paramsType: Array<ClassType>, returnType: ClassType, isMemberFunc: boolean) {
    this.globalName = globalName;
    this.paramsType = paramsType;
    this.returnType = returnType;
    this.isMemberFunc = isMemberFunc;
  }

  public getName(): string {
    let components = this.globalName.split("$");
    return components[components.length - 1];
  }

  public isOverload(ft: FuncType): boolean {
    if (this.paramsType.length !== ft.paramsType.length) {
      return false;
    }
    let idx = 0;
    if (this.isMemberFunc) {
      idx = 1;
    }
    for (let i = idx; i < this.paramsType.length; i++) {
      let p1 = this.paramsType[i];
      let p2 = ft.paramsType[i];
      if (p1.globalName !== p2.globalName) {
        return false;
      }
    }
    if (this.returnType.globalName !== ft.returnType.globalName) {
      return false;
    }
    return true;
  }
};

export class ClassType {
  globalName: string;
  methods: Map<string, FuncType>;
  methodPtrs: Map<string, number>;
  methodPtrsHead: number;
  attributes: Map<string, Variable>;
  parent: ClassType;
  size: number;
  tag: number;
  headerSize: number;

  constructor(globalName: string, parent: ClassType, tag: number) {
    this.globalName = globalName;
    this.methods = new Map();
    this.methodPtrs = new Map();
    this.attributes = new Map();
    this.parent = parent;
    this.size = 0;
    this.tag = tag;
    this.headerSize = 3;  // tag, size, dispatchTablePtr
  }

  public getDispatchTablePtrOffset(): number {
    return this.headerSize - 1;
  }

  public getName(): string {
    let components = this.globalName.split("$");
    return components[components.length - 1];
  }

  public hasDescendant(descendant: ClassType): boolean {
    if (descendant.globalName === "$<None>" && 
    (this.globalName !== "$int" && this.globalName !== "$bool")) {
      return true;
    }
    let c = descendant;
    while (c) {
      if (c.globalName == this.globalName) {
        return true;
      }
      c = c.parent;
    }
    return false;
  }
}

export type Value =
  { tag: "none" }
  | { tag: "bool", value: boolean }
  | { tag: "num", value: number }
  | { tag: "object", name: string, address: number }

export type Type =
  | { tag: "number" }
  | { tag: "bool" }
  | { tag: "none" }
  | { tag: "class", name: string }

export type ImportObject = {
  js: { mem: WebAssembly.Memory },
  imports: any,
}

