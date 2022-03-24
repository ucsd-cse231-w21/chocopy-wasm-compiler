import { BinOp } from './ast';
import { Expr, Program, Stmt, Value } from './ir';

// let console.log = console.log;

export function printProgram<A>(p : Program<A>) {
  p.stmts.map(printStmt);  
}

function printStmt<A>(stmt : Stmt<A>) {
  console.log("--" + stmt.tag);
  switch(stmt.tag) {
    case "assign":
      console.log("  " + stmt.name + " = ");
      printExpr(stmt.value);
      break;

    case "return":
      break;

    case "expr":
      console.log(" --> " + stmt.expr.tag + "\n");
      printExpr(stmt.expr);
      break;

    case "pass":
      break;

    case "field-assign":
      console.log(stmt.tag + " not handled yet");
      break;

    case "ifjmp":
      console.log(stmt.tag + " not handled yet");
      break;

    case "label":
      console.log(" label: " + stmt.name);
      break;

    case "jmp":
      console.log(" --> " + stmt.lbl);
      break;
  }
  console.log("\n");
}

function printExpr<A>(expr : Expr<A>) {
  console.log("----" + expr.tag);
  switch(expr.tag) {
    case "value":
      printValue(expr.value);
      break;

    case "binop":
      printValue(expr.left)
      console.log(BinOp[expr.op]);
      printValue(expr.right)
      break;

    case "uniop":
      break;

    case "builtin1":
      break;

    case "builtin2":
      break;

    case "call":
      break;

    case "lookup":
      break;

    case "method-call":
      break;

    case "construct":
      break;

  }
  console.log("\n");
}

function printValue<A>(value : Value<A>) {
  console.log(" ");
  switch(value.tag) {
    case "num":
      console.log(value.value.toString());
      break;
    case "bool":
      console.log(value.value.toString());
      break;
    case "id":
      console.log(value.name);
      break;
    case "none":
      console.log("None");
      break;
  }
  console.log(" ");
}