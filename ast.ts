// import { TypeCheckError } from "./type-check";

// export enum Type {NUM, BOOL, NONE, OBJ};
export type Type =
  | { tag: "number" }
  | { tag: "bool" }
  | { tag: "none" }
  | { tag: "string" }
  | { tag: "class"; name: string }
  | { tag: "list"; content_type: Type }
  | { tag: "dict"; key: Type; value: Type }
  | { tag: "tuple"; contentTypes: Array<Type> }
  | CallableType;

export type CallableType = {
  tag: "callable";
  args: Array<Parameter>;
  ret: Type;
  isVar?: boolean; // is a variable
};

export type Scope<A> =
  | { a?: A; tag: "global"; name: string } // not support
  | { a?: A; tag: "nonlocal"; name: string };

export type Parameter = { name: string; type: Type; value?: Literal };

export type Program<A> = {
  a?: A;
  funs: Array<FunDef<A>>;
  inits: Array<VarInit<A>>;
  classes: Array<Class<A>>;
  stmts: Array<Stmt<A>>;
  closures: Array<ClosureDef<A>>;
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
  parameters: Array<Parameter>;
  ret: Type;
  decls: Array<Scope<A>>;
  inits: Array<VarInit<A>>;
  funs: Array<FunDef<A>>;
  body: Array<Stmt<A>>;
};

/** Compiled as a function in wasm */
export type ClosureDef<A> = {
  a?: A;
  name: string;
  parameters: Array<Parameter>; // excluding the nonlocal pointer
  ret: Type;
  nonlocals: Array<string>;
  nested: Array<string>;
  inits: Array<VarInit<A>>;
  isGlobal: boolean;
  body: Array<Stmt<A>>;
};

export type Stmt<A> =
  | { a?: A; tag: "assignment"; destruct: Destructure<A>; value: Expr<A> }
  | { a?: A; tag: "return"; value: Expr<A> }
  | { a?: A; tag: "expr"; expr: Expr<A> }
  | { a?: A; tag: "if"; cond: Expr<A>; thn: Array<Stmt<A>>; els: Array<Stmt<A>> }
  | { a?: A; tag: "while"; cond: Expr<A>; body: Array<Stmt<A>> }
  | { a?: A; tag: "pass" }
  | { a?: A; tag: "field-assign"; obj: Expr<A>; field: string; value: Expr<A> }
  | { a?: A; tag: "continue"; depth?: number }
  | { a?: A; tag: "break"; depth?: number } // depth is used for wasm 'br' instruction
  | { a?: A; tag: "for"; name: string; index?: string; iterable: Expr<A>; body: Array<Stmt<A>> }
  | { a?: A; tag: "bracket-assign"; obj: Expr<A>; key: Expr<A>; value: Expr<A> };

/**
 * Description of assign targets. isDestructured indicates if we are doing
 * object destructuring and targets is an array of targets. One case where this
 * distinction is important is with single element tuples:
 *
 * `(a,) = (1,)` vs. `a = (1,)`
 *
 * The first assigns `a = 1` while the second results in `a = (1,)`
 */
export interface Destructure<A> {
  // Info about the value that is being destructured
  valueType?: A;
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
export const ASSIGNABLE_TAGS = ["id", "lookup", "bracket-lookup"] as const;
/**
 * Subset of Expr types which are valid as assign targets
 */
export type Assignable<A> =
  | { a?: A; tag: "id"; name: string }
  | { a?: A; tag: "lookup"; obj: Expr<A>; field: string }
  | { a?: A; tag: "bracket-lookup"; obj: Expr<A>; key: Expr<A> };

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
  | {
      a?: A;
      tag: "method-call";
      obj: Expr<A>;
      method: string;
      arguments: Array<Expr<A>>;
    }
  | { a?: A; tag: "construct"; name: string }
  | { a?: A; tag: "lambda"; args: Array<string>; ret: Expr<A> }
  | {
      a?: A;
      tag: "comprehension";
      expr: Expr<A>;
      field: string;
      iter: Expr<A>;
      cond?: Expr<A>;
    }
  | { a?: A; tag: "block"; block: Array<Stmt<A>>; expr: Expr<A> }
  | { a?: A; tag: "call_expr"; name: Expr<A>; arguments: Array<Expr<A>> }
  | { a?: A; tag: "list-expr"; contents: Array<Expr<A>> }
  | { a?: A; tag: "slicing"; name: Expr<A>; start?: Expr<A>; end?: Expr<A>; stride: Expr<A> }
  | { a?: A; tag: "dict"; entries: Array<[Expr<A>, Expr<A>]> }
  | { a?: A; tag: "bracket-lookup"; obj: Expr<A>; key: Expr<A> }
  | { a?: A; tag: "tuple-expr"; contents: Array<Expr<A>> };

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
  | { tag: "string"; value: string; address: number }
  | { tag: "object"; name: string; address: number }
  | { tag: "list"; name: string; address: number; content_type: Type }
  | { tag: "callable"; name: string; address: number };

export type Location = { line: number; col: number; length: number; fileId: number };
