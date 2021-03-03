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

export type Scope<A> =
  | { a?: A; tag: "global"; name: string } // not support
  | { a?: A; tag: "nonlocal"; name: string };

export type Parameter<A> = { name: string; type: Type; value?: Literal; loc?:Location};

export type Program<A> = {
  a?: A;
  funs: Array<FunDef<A>>;
  inits: Array<VarInit<A>>;
  classes: Array<Class<A>>;
  stmts: Array<Stmt<A>>;
  loc?: Location;
};

export type Class<A> = {
  a?: A;
  name: string;
  fields: Array<VarInit<A>>;
  methods: Array<FunDef<A>>;
  loc?: Location;
};

export type VarInit<A> = { a?: A; name: string; type: Type; value: Literal; loc?: Location };

export type FunDef<A> = {
  a?: A;
  name: string;
  parameters: Array<Parameter<A>>;
  ret: Type;
  decls: Array<Scope<A>>;
  inits: Array<VarInit<A>>;
  funs: Array<FunDef<A>>;
  body: Array<Stmt<A>>;
  loc?: Location;
};

export type Closure<A> = {
  a?: A;
  name: string;
  fields: Array<VarInit<A>>;
  apply: FunDef<A>;
};

export type Stmt<A> =
  | { a?: A; tag: "assignment"; target: Destructure<A>; value: Expr<A>;loc?: Location } // TODO: unify field assignment with destructuring. This will eventually replace tag: "id-assign"
  | { a?: A; tag: "assign"; name: string; value: Expr<A>; loc?: Location}
  | { a?: A; tag: "return"; value: Expr<A>; loc?: Location }
  | { a?: A; tag: "expr"; expr: Expr<A>; loc?: Location }
  | { a?: A; tag: "if"; cond: Expr<A>; thn: Array<Stmt<A>>; els: Array<Stmt<A>>; loc?: Location }
  | { a?: A; tag: "while"; cond: Expr<A>; body: Array<Stmt<A>>; loc?: Location}
  | { a?: A; tag: "pass"; loc?: Location }
  | { a?: A; tag: "field-assign"; obj: Expr<A>; field: string; value: Expr<A>; loc?: Location}
  | { a?: A; tag: "continue"; loc?: Location}
  | { a?: A; tag: "break"; loc?: Location }
  | { a?: A; tag: "for"; name: string; index?: Expr<A>; iterable: Expr<A>; body: Array<Stmt<A>>; loc?: Location}
  | { a?: A; tag: "bracket-assign"; obj: Expr<A>; key: Expr<A>; value: Expr<A>; loc?: Location};

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
  | { a?: A; tag: "id"; name: string; loc?: Location }
  | { a?: A; tag: "lookup"; obj: Expr<A>; field: string; loc?: Location };

export type Expr<A> =
  | { a?: A; tag: "literal"; value: Literal; loc?: Location}
  | { a?: A; tag: "binop"; op: BinOp; left: Expr<A>; right: Expr<A>; loc?: Location}
  | { a?: A; tag: "uniop"; op: UniOp; expr: Expr<A>; loc?: Location}
  | { a?: A; tag: "builtin1"; name: string; arg: Expr<A>; loc?: Location}
  | { a?: A; tag: "builtin2"; name: string; left: Expr<A>; right: Expr<A>; loc?: Location}
  | { a?: A; tag: "call"; name: string; arguments: Array<Expr<A>>; loc?: Location}
  // ASSIGNABLE EXPRS
  | { a?: A; tag: "id"; name: string; loc?: Location}
  | { a?: A; tag: "lookup"; obj: Expr<A>; field: string; loc?: Location}
  // END ASSIGNABLE EXPRS
  | { a?: A; tag: "method-call"; obj: Expr<A>; method: string; arguments: Array<Expr<A>>; loc?: Location }
  | { a?: A; tag: "construct"; name: string; loc?: Location}
  | { a?: A; tag: "lambda"; args: Array<string>; ret: Expr<A>; loc?: Location}
  | { a?: A; tag: "comprehension"; expr: Expr<A>; field: string; iter: Expr<A>; cond?: Expr<A>; loc?: Location}
  | { a?: A; tag: "block"; block: Array<Stmt<A>>; expr: Expr<A>; loc?: Location}
  | { a?: A; tag: "list-expr"; contents: Array<Expr<A>>; loc?: Location}
  | { a?: A; tag: "string_slicing"; name: Expr<A>; start: Expr<A>; end: Expr<A>; stride: Expr<A>; loc?: Location}
  | { a?: A; tag: "dict"; entries: Array<[Expr<A>, Expr<A>]>; loc?: Location}
  | { a?: A; tag: "bracket-lookup"; obj: Expr<A>; key: Expr<A>; loc?: Location};

export type Literal =
  | { tag: "num"; value: bigint; loc?: Location}
  | { tag: "bool"; value: boolean; loc?: Location}
  | { tag: "string"; value: string; loc?: Location}
  | { tag: "none"; loc?: Location};


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
