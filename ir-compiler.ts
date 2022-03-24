import { Stmt, Expr, Value } from "./ir"
import { Type } from "./ast"

export type GlobalEnv = {
  globals: Map<string, number>;
  classes: Map<string, Map<string, [number, Value<Type>]>>;  
  locals: Set<string>;
  offset: number;
}

function codeGenStmt(stmt: Stmt<Type>, env: GlobalEnv): Array<string> {
  switch (stmt.tag) {
    case "assign":
      return []

    case "return":
      return []

    case "expr":
      var exprStmts = codeGenExpr(stmt.expr, env);
      return exprStmts.concat([`(local.set $$last)`]);

    case "pass":
      return []

    case "field-assign":
      return []

    case "ifjmp":
      return []

    case "label":
      return []

    case "jmp":
      return []

  }
}

function codeGenExpr(expr: Expr<Type>, env: GlobalEnv): Array<string> {
  switch (expr.tag) {
    case "value":
      return codeGenValue(expr.value, env)

    case "binop":
      return []

    case "uniop":
      return []

    case "builtin1":
      return []

    case "builtin2":
      return []

    case "call":
      return []

    case "lookup":
      return []

    case "method-call":
      return []

    case "construct":
      return []
  }
}

function codeGenValue(val: Value<Type>, env: GlobalEnv): Array<string> {
  switch (val.tag) {
    case "num":
      return ["(i32.const " + val.value + ")"];
    case "bool":
      return [`(i32.const ${Number(val.value)})`];
    case "none":
      return [`(i32.const 0)`];

    case "id":
      if (env.locals.has(val.name)) {
        return [`(local.get $${val.name})`];
      } else {
        return [`(i32.const ${envLookup(env, val.name)})`, `(i32.load)`]
      }
  }
}

function envLookup(env : GlobalEnv, name : string) : number {
  if(!env.globals.has(name)) { console.log("Could not find " + name + " in ", env); throw new Error("Could not find name " + name); }
  return (env.globals.get(name) * 4); // 4-byte values
}