import { Stmt, Expr, Op } from "./ast";
import { parse } from "./parser";

// https://learnxinyminutes.com/docs/wasm/

type LocalEnv = Map<string, boolean>;

type CompileResult = {
  functions: string,
  mainSource: string,
};

export function compile(source: string) : CompileResult {
  const ast = parse(source);
  const definedVars = new Set();
  ast.forEach(s => {
    switch(s.tag) {
      case "define":
        definedVars.add(s.name);
        break;
    }
  }); 
  const scratchVar : string = `(local $$last i32)`;
  const localDefines = [scratchVar];
  definedVars.forEach(v => {
    localDefines.push(`(local $${v} i32)`);
  })

  const funs : Array<string> = [];
  ast.forEach((stmt, i) => {
    if(stmt.tag === "fun") { funs.push(codeGen(stmt).join("\n")); }
  });
  const allFuns = funs.join("\n\n");
  const stmts = ast.filter((stmt) => stmt.tag !== "fun");
  
  const commandGroups = stmts.map((stmt) => codeGen(stmt));
  const commands = localDefines.concat([].concat.apply([], commandGroups));
  return {
    functions: allFuns,
    mainSource: commands.join("\n"),
  };
}

function codeGen(stmt: Stmt) : Array<string> {
  switch(stmt.tag) {
    case "fun":
      var params = stmt.parameters.map(p => `(param $${p.name} i32)`).join(" ");
      var stmts = stmt.body.map(codeGen).flat();
      var stmtsBody = stmts.join("\n");
      return [`(func $${stmt.name} ${params} (result i32) (local $$last i32) ${stmtsBody} (i32.const 0) (return))`];
    case "return":
      var valStmts = codeGenExpr(stmt.value);
      valStmts.push("return");
      return valStmts;
    case "define":
      var valStmts = codeGenExpr(stmt.value);
      return valStmts.concat([`(local.set $${stmt.name})`]);
    case "expr":
      var exprStmts = codeGenExpr(stmt.expr);
      return exprStmts.concat([`(local.set $$last)`]);
  }
}

function codeGenExpr(expr : Expr) : Array<string> {
  switch(expr.tag) {
    case "builtin1":
      const argStmts = codeGenExpr(expr.arg);
      return argStmts.concat([`(call $${expr.name})`]);
    case "builtin2":
      const leftStmts = codeGenExpr(expr.left);
      const rightStmts = codeGenExpr(expr.right);
      return [...leftStmts, ...rightStmts, `(call $${expr.name})`]
    case "num":
      return ["(i32.const " + expr.value + ")"];
    case "id":
      return [`(local.get $${expr.name})`];
    case "op":
      const lhsStmts = codeGenExpr(expr.left);
      const rhsStmts = codeGenExpr(expr.right);
      return [...lhsStmts, ...rhsStmts, codeGenOp(expr.op)]
    case "call":
      var valStmts = expr.arguments.map(codeGenExpr).flat();
      valStmts.push(`(call $${expr.name})`);
      return valStmts;
  }
}

function codeGenOp(op : Op) : string {
  switch(op) {
    case Op.Plus:
      return "(i32.add)"
    case Op.Minus:
      return "(i32.sub)"
    case Op.Mul:
      return "(i32.mul)"
  }
}
