/** Escape analysis */
import { Type, Program, FunDef, Class, ClosureDef, Stmt, Expr } from "./ast";

/** The seperater used to flatten nested functions */
export const EA_NAMING_SEP = "_$";

/** This name is used to dereference, using a field_assign stmt or a lookup expr */
export const EA_DEREF_FIELD = "$deref";

/** This name is the type of a reference, expressed with a class type */
export const EA_REF_CLASS = "$ref";

/** Callee with this prefix means that the expression is a closure application */
export const EA_PREFIX_CAPP = "$capp$";

/** Field assign/lookup whose obj is an id of this name represents nonlocal vars */
export const EA_NONLOCAL_OBJ = "$nl_ptr$";

type LocalEnv = {
  name: string;
  prefix: string;
  ids: string[];
  parent: LocalEnv; // null for global
};

const globalLocalEnv: () => LocalEnv = () => ({
  name: "global",
  prefix: "",
  ids: [],
  parent: null,
});

