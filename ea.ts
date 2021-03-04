/** Escape analysis */
import { warn } from "console";
import { Type, Program, FunDef, Class, ClosureDef, Stmt, Expr } from "./ast";

/** The seperater used to flatten nested functions */
export const EA_NAMING_SEP = "_$";

/** This name is used to dereference, using a field_assign stmt or a lookup expr */
export const EA_DEREF_FIELD = "$deref";

/** This name is the type of a reference, expressed with a class type */
export const EA_REF_CLASS = "$ref";
const TRef: Type = { tag: "class", name: EA_REF_CLASS };

/** Field assign/lookup whose obj is an id of this name represents nonlocally mutable vars */
export const EA_NONLOCAL_OBJ = "$nl_ptr$";

type LocalEnv = {
  name: string;
  prefix: string;
  varIds: string[];
  funIds: string[];
  parent: LocalEnv; // null for global
};

const globalLocalEnv: (fun_names: string[]) => LocalEnv = (fun_names: string[]) => ({
  name: "global",
  prefix: "",
  varIds: [],
  funIds: [], // use the original name
  parent: null,
});

export function ea(tAst: Program<Type>): Program<Type> {
  return {
    a: tAst.a,
    funs: [],
    inits: tAst.inits,
    classes: tAst.classes,
    stmts: tAst.stmts,
    closures: [].concat(
      ...tAst.funs.map((f) => eaFunDef(f, globalLocalEnv(tAst.funs.map((f) => f.name))))
    ),
  };
}

// TODO
export function eaClass(cl: Class<Type>): Class<Type> {
  return {
    a: cl.a,
    name: cl.name,
    fields: cl.fields,
    // TODO: check nonlocals
    methods: [].concat(
      ...cl.methods.map((f) => eaFunDef(f, globalLocalEnv(cl.methods.map((f) => f.name))))
    ),
  };
}

/**
 * Do escape analysis for a function and flatten it to an array of closures without
 * nested functions.
 * @param f The function definition to flatten
 * @param prefix Prefix of current function's flatten name, expressed as python name
 * @param parentEnv parent's (not ancestors') local environment
 * @returns The first element should be the closure of `f`, followed by closure of its
 * inner functions.
 */
export function eaFunDef(f: FunDef<Type>, parentEnv: LocalEnv): ClosureDef<Type>[] {
  // create local variable environment
  const localEnv: LocalEnv = {
    name: f.name,
    prefix: parentEnv.prefix + f.name + EA_NAMING_SEP,
    varIds: [],
    funIds: [],
    parent: parentEnv,
  };
  f.parameters.forEach((p) => localEnv.varIds.push(p.name));
  f.inits.forEach((i) => localEnv.varIds.push(i.name));
  f.funs.forEach((nf) => localEnv.funIds.push(nf.name));

  // recursively apply to inner functions
  const innerClosures: ClosureDef<Type>[] = [];
  const nonlocalSet = new Set<string>();
  const absFunIds = localEnv.funIds.map((n) => localEnv.prefix + n);
  f.funs.forEach((f) => {
    const cs = eaFunDef(f, localEnv);
    innerClosures.push(...cs);
    cs[0].nonlocals.forEach((v) => {
      if (!localEnv.varIds.includes(v) && !absFunIds.includes(v)) {
        nonlocalSet.add(v);
      }
    });
  });

  const processedBody = f.body.map((s) => eaStmt(s, localEnv, nonlocalSet));

  const currClosure: ClosureDef<Type> = {
    a: f.a,
    name: lookupId(f.name, localEnv).name,
    parameters: f.parameters,
    ret: f.ret,
    nonlocals: [...nonlocalSet],
    nested: f.funs.map((nf) => localEnv.prefix + nf.name),
    inits: f.inits,
    body: processedBody,
  };

  return [currClosure].concat(innerClosures);
}

/**
 * Do escape analysis for a statement.
 *
 * Notes for other groups to add cases: Generally, first call eaExpr for all expr
 * component and call eaStmt for all stmt components. After that, reconstruct the
 * ast.
 *
 * @param nSet is used to keep track of nonlocal variables used in the curent function
 * @returns Converted statement
 */
function eaStmt(stmt: Stmt<Type>, e: LocalEnv, nSet: Set<string>): Stmt<Type> {
  switch (stmt.tag) {
    case "assignment":
      return { ...stmt }; // TODO: assume everything escapes by now

    case "assign":
      const aid = lookupId(stmt.name, e);
      // TODO: assume all nonlocal is mutable now
      if (aid.isNonlocal) {
        nSet.add(stmt.name);
        return {
          a: stmt.a,
          tag: "field-assign",
          obj: { a: TRef, tag: "id", name: stmt.name },
          field: EA_DEREF_FIELD,
          value: eaExpr(stmt.value, e, nSet),
        };
      } else {
        return { ...stmt, name: aid.name };
      }

    case "return":
      return { ...stmt, value: eaExpr(stmt.value, e, nSet) };

    case "expr":
      return { ...stmt, expr: eaExpr(stmt.expr, e, nSet) };

    case "if":
      return {
        ...stmt,
        cond: eaExpr(stmt.cond, e, nSet),
        thn: stmt.thn.map((s) => eaStmt(s, e, nSet)),
        els: stmt.els.map((s) => eaStmt(s, e, nSet)),
      };

    case "while":
      return {
        ...stmt,
        cond: eaExpr(stmt.cond, e, nSet),
        body: stmt.body.map((s) => eaStmt(s, e, nSet)),
      };

    case "pass":
      return stmt;

    case "field-assign":
      return { ...stmt, obj: eaExpr(stmt.obj, e, nSet), value: eaExpr(stmt.value, e, nSet) };

    case "continue":
      return stmt;

    case "break":
      return stmt;

    case "for":
      return { ...stmt }; // TODO

    case "bracket-assign":
      return { ...stmt }; // TODO
  }
}

/**
 * Do escape analysis for an expression.
 *
 * Notes for other groups to add cases: Generally, first call eaExpr for all expr
 * component and call eaStmt for all stmt components. After that, reconstruct the
 * ast.
 *
 * @param nSet is used to keep track of nonlocal variables used in the curent function
 * @returns If this stmt used something nonlocal
 */
function eaExpr(expr: Expr<Type>, e: LocalEnv, nSet: Set<string>): Expr<Type> {
  switch (expr.tag) {
    case "literal":
      return expr;

    case "binop":
      return { ...expr, left: eaExpr(expr.left, e, nSet), right: eaExpr(expr.right, e, nSet) };

    case "uniop":
      return { ...expr, expr: eaExpr(expr.expr, e, nSet) };

    case "builtin1":
      return { ...expr, arg: eaExpr(expr.arg, e, nSet) };

    case "builtin2":
      return { ...expr, left: eaExpr(expr.left, e, nSet), right: eaExpr(expr.right, e, nSet) };

    case "call":
      warn("Use call_expr instead to support first class functions.");
      return eaExpr(
        {
          a: expr.a,
          tag: "call_expr",
          name: {
            a: { tag: "callable", args: expr.arguments.map((a) => a.a), ret: expr.a },
            tag: "id",
            name: expr.name,
          },
          arguments: expr.arguments,
        },
        e,
        nSet
      );

    case "id":
      const idid = lookupId(expr.name, e);
      if (idid.isNonlocal) {
        nSet.add(idid.name);
        return {
          a: expr.a,
          tag: "lookup",
          obj: { a: TRef, tag: "id", name: expr.name },
          field: EA_DEREF_FIELD,
        };
      } else {
        return { ...expr, name: idid.name };
      }

    case "lookup":
      return { ...expr, obj: eaExpr(expr.obj, e, nSet) };

    case "method-call":
      return {
        ...expr,
        obj: eaExpr(expr.obj, e, nSet),
        arguments: expr.arguments.map((a) => eaExpr(a, e, nSet)),
      };

    case "construct":
      return expr;

    case "lambda":
      throw new Error(`ea not yet implemented!: ${expr.tag}`);

    case "comprehension":
      throw new Error(`ea not yet implemented!: ${expr.tag}`);

    case "block":
      throw new Error(`ea not yet implemented!: ${expr.tag}`);

    case "call_expr":
      return {
        ...expr,
        name: eaExpr(expr.name, e, nSet),
        arguments: expr.arguments.map((a) => eaExpr(a, e, nSet)),
      };

    case "list-expr":
      throw new Error(`ea not yet implemented!: ${expr.tag}`);

    case "string_slicing":
      throw new Error(`ea not yet implemented!: ${expr.tag}`);

    case "dict":
      throw new Error(`ea not yet implemented!: ${expr.tag}`);

    case "bracket-lookup":
      throw new Error(`ea not yet implemented!: ${expr.tag}`);
  }
}

/**
 * Lookup a name in local name space.
 */
function lookupId(n: string, local: LocalEnv): { isNonlocal: boolean; name: string } {
  // n is a local variable
  if (local.varIds.includes(n)) return { isNonlocal: false, name: n };

  // n is a child function
  if (local.funIds.includes(n)) return { isNonlocal: false, name: local.prefix + n };

  // n is a glocal variable
  if (local.parent == null) return { isNonlocal: false, name: n };

  const nameInParent = lookupId(n, local.parent);
  return nameInParent == null
    ? { isNonlocal: false, name: null }
    : { isNonlocal: true, name: nameInParent.name };
}
