/** Escape analysis */
// import { warn } from "console";
import {
  Type,
  Program,
  FunDef,
  Class,
  ClosureDef,
  Stmt,
  Expr,
  Destructure,
  AssignTarget,
  Location,
} from "./ast";
import * as BaseException from "./error";

/** The seperater used to flatten nested functions */
export const EA_NAMING_SEP = "_$";

/** This name is used to dereference, using a field_assign stmt or a lookup expr */
export const EA_DEREF_FIELD = "$deref";

/** This name is the type of a reference, expressed with a class type */
export const EA_REF_CLASS = "$ref";
const TRef: Type = { tag: "class", name: EA_REF_CLASS };

/** Field assign/lookup whose obj is an id of this name represents nonlocally mutable vars */
export const EA_NONLOCAL_OBJ = "$nl_ptr$";

export const EA_REF_SUFFIX = "_$ref";

type LocalEnv = {
  name: string; // function name(without prefix)
  prefix: string; // prefix is used to rename nested functions
  varIds: string[]; // local variables & parameters
  funIds: string[]; // nested functions defined (name without prefix)
  parent: LocalEnv; // parent namespace, null for global
};

const globalLocalEnv: (fun_names: string[]) => LocalEnv = (fun_names: string[]) => ({
  name: "global",
  prefix: "",
  varIds: [],
  funIds: [],
  parent: null,
});

/**
 * Entry point of escape analysis.
 * @param tAst Typed ast
 * @returns Flattened ast with no nest functions
 */
export function ea(tAst: Program<[Type, Location]>): Program<[Type, Location]> {
  return {
    a: tAst.a,
    funs: [],
    inits: tAst.inits,
    classes: tAst.classes,
    stmts: tAst.stmts,
    closures: [].concat(
      ...tAst.funs.map((f) => eaFunDef(f, globalLocalEnv(tAst.funs.map((f) => f.name)), true))
    ),
  };
}

// TODO (closure group): ea for classes are not fully tested
export function eaClass(cl: Class<[Type, Location]>): Class<[Type, Location]> {
  return {
    a: cl.a,
    name: cl.name,
    fields: cl.fields,
    methods: [].concat(
      ...cl.methods.map((f) => eaFunDef(f, globalLocalEnv(cl.methods.map((f) => f.name)), false))
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
export function eaFunDef(
  f: FunDef<[Type, Location]>,
  parentEnv: LocalEnv,
  isGlobal: boolean
): ClosureDef<[Type, Location]>[] {
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
  const innerClosures: ClosureDef<[Type, Location]>[] = [];
  const nonlocalSet = new Set<string>();
  const absFunIds = localEnv.funIds.map((n) => localEnv.prefix + n);
  f.funs.forEach((f) => {
    const cs = eaFunDef(f, localEnv, false);
    innerClosures.push(...cs);
    cs[0].nonlocals.forEach((v) => {
      if (!localEnv.varIds.includes(v) && !absFunIds.includes(v)) {
        nonlocalSet.add(v);
      }
    });
  });

  const processedBody = f.body.map((s) => eaStmt(s, localEnv, nonlocalSet));

  const currClosure: ClosureDef<[Type, Location]> = {
    a: f.a,
    name: lookupId(f.name, localEnv).name,
    parameters: f.parameters,
    ret: f.ret,
    nonlocals: [...nonlocalSet],
    nested: f.funs.map((nf) => localEnv.prefix + nf.name),
    inits: f.inits,
    isGlobal: isGlobal,
    body: processedBody,
  };

  return [currClosure].concat(innerClosures);
}

/**
 * Do escape analysis for a statement.
 *
 * Notes for other groups to add cases: Generally, first call eaExpr for all expr
 * component and call eaStmt for all stmt components. After that, reconstruct the
 * ast. See assignment case if some name/identifier are used directly without id
 * expression.
 *
 * @param nSet is used to keep track of nonlocal variables used in the curent
 * function. Add used name/identifier to this set.
 * @returns Converted statement
 */
function eaStmt(
  stmt: Stmt<[Type, Location]>,
  e: LocalEnv,
  nSet: Set<string>
): Stmt<[Type, Location]> {
  switch (stmt.tag) {
    case "assignment":
      const targets: AssignTarget<[Type, Location]>[] = stmt.destruct.targets.map((at) => {
        if (at.ignore) return at; // do nothing for the ignore case
        switch (at.target.tag) {
          case "id":
            const id = lookupId(at.target.name, e);
            if (id.varScope == VarScope.GLOBAL) return at; // Globel names should keep the same
            if (id.varScope == VarScope.NONLOCAL) nSet.add(id.name);
            return {
              ...at,
              target: {
                a: at.target.a,
                tag: "lookup",
                obj: { a: [TRef, at.target.a[1]], tag: "id", name: at.target.name + EA_REF_SUFFIX },
                field: EA_DEREF_FIELD,
              },
            };
          case "lookup":
            return { ...at, target: { ...at.target, obj: eaExpr(at.target.obj, e, nSet) } };
          case "bracket-lookup": {
            throw new Error('Not implemented yet: "bracket-lookup" case');
          }
        }
      });

      const aVlaue = eaExpr(stmt.value, e, nSet);
      const aDestruct: Destructure<[Type, Location]> = {
        ...stmt.destruct,
        targets: targets,
      };
      // TODO (closure group): assume everything escapes by now
      return { ...stmt, destruct: aDestruct, value: aVlaue };

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

    case "continue":
      return stmt;

    case "break":
      return stmt;

    case "for":
      return { ...stmt }; // TODO: implement ea for this new case while merging

    case "bracket-assign":
      return { ...stmt }; // TODO: implement ea for this new case while merging
  }
}

/**
 * Do escape analysis for an expression.
 *
 * Notes for other groups to add cases: Generally, first call eaExpr for all expr
 * component and call eaStmt for all stmt components. After that, reconstruct the
 * ast. See id case if some name/identifier are used directly without id expression.
 *
 * @param nSet is used to keep track of nonlocal variables used in the curent
 * function. Add used name/identifier to this set.
 * @returns Converted expression
 */
function eaExpr(
  expr: Expr<[Type, Location]>,
  e: LocalEnv,
  nSet: Set<string>
): Expr<[Type, Location]> {
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
      throw new Error("Pls migrate to call_expr whose callee is an expression.");

    case "id":
      const idid = lookupId(expr.name, e);
      if (idid.varScope != VarScope.GLOBAL) {
        if (idid.varScope == VarScope.NONLOCAL) nSet.add(idid.name);
        return {
          a: expr.a,
          tag: "lookup",
          obj: { a: [TRef, expr.a[1]], tag: "id", name: idid.name + EA_REF_SUFFIX },
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
      throw new BaseException.InternalException(`ea not yet implemented!: ${expr.tag}`);

    case "comprehension":
      throw new BaseException.InternalException(`ea not yet implemented!: ${expr.tag}`);

    case "block":
      throw new BaseException.InternalException(`ea not yet implemented!: ${expr.tag}`);

    case "call_expr":
      return {
        ...expr,
        name: eaExpr(expr.name, e, nSet),
        arguments: expr.arguments.map((a) => eaExpr(a, e, nSet)),
      };

    case "list-expr":
      throw new BaseException.InternalException(`ea not yet implemented!: ${expr.tag}`);

    case "tuple-expr":
      return {
        ...expr,
        contents: expr.contents.map((c) => eaExpr(c, e, nSet)),
      };

    case "slicing":
      throw new BaseException.InternalException(`ea not yet implemented!: ${expr.tag}`);

    case "dict":
      throw new BaseException.InternalException(`ea not yet implemented!: ${expr.tag}`);

    case "bracket-lookup":
      return {
        ...expr,
        obj: eaExpr(expr.obj, e, nSet),
        key: eaExpr(expr.key, e, nSet),
      };
  }
}

enum VarScope {
  GLOBAL,
  NONLOCAL,
  LOCAL,
}

/**
 * Lookup a name in the given space.
 * @returns The scope if the identifier and a prefixed name if it is an function
 */
function lookupId(n: string, local: LocalEnv): { varScope: VarScope; name: string } {
  // n is a local variable
  if (local.varIds.includes(n)) return { varScope: VarScope.LOCAL, name: n };

  // n is a child function
  if (local.funIds.includes(n)) return { varScope: VarScope.LOCAL, name: local.prefix + n };

  // n is a glocal variable
  if (local.parent == null) return { varScope: VarScope.GLOBAL, name: n };

  const nameInParent = lookupId(n, local.parent);
  return nameInParent.varScope == VarScope.GLOBAL
    ? { varScope: VarScope.GLOBAL, name: nameInParent.name }
    : { varScope: VarScope.NONLOCAL, name: nameInParent.name };
}
