import {parser} from "lezer-python";
import {TreeCursor} from "lezer-tree";
import {Expr, Stmt, Op, Parameter} from "./ast";

export function traverseExpr(c : TreeCursor, s : string) : Expr {
  switch(c.type.name) {
    case "Number":
      return {
        tag: "num",
        value: Number(s.substring(c.from, c.to))
      }
    case "VariableName":
      return {
        tag: "id",
        name: s.substring(c.from, c.to)
      }
    case "CallExpression":
      c.firstChild();
      const callName = s.substring(c.from, c.to);
      c.nextSibling(); // go to arglist
      c.firstChild(); // go into arglist

      let args = traverseArguments(c, s);

      var expr : Expr;
      if (callName === "print" || callName === "abs") {
        expr = {
          tag: "builtin1",
          name: callName,
          arg: args[0]
        };
      } else if (callName === "max" || callName === "min" || callName === "pow") {
        expr = {
          tag: "builtin2",
          name: callName,
          left: args[0],
          right: args[1]
        }
      }
      else {
        expr = { tag: "call", name: callName, arguments: args};
      }
      c.parent(); // pop arglist
      c.parent(); // pop CallExpression
      return expr;
    case "BinaryExpression":
      c.firstChild(); // go to lhs 
      const lhsExpr = traverseExpr(c, s);
      c.nextSibling(); // go to op
      const opStr = s.substring(c.from, c.to);
      var op;
      switch(opStr) {
        case "+":
          op = Op.Plus;
          break;
        case "-":
          op = Op.Minus;
          break;
        case "*":
          op = Op.Mul;
          break;
        default:
          throw new Error("Could not parse op at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to))
      }
      c.nextSibling(); // go to rhs
      const rhsExpr = traverseExpr(c, s);
      c.parent()
      return {
        tag: "op",
        op: op,
        left: lhsExpr,
        right: rhsExpr
      }
    default:
      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseArguments(c : TreeCursor, s : string) : Array<Expr> {
  c.firstChild();  // Focuses on open paren
  const args = [];
  do {
    c.nextSibling(); // Focuses on a VariableName
    let expr = traverseExpr(c, s);
    args.push(expr);
    c.nextSibling(); // Focuses on either "," or ")"
  } while(c.type.name !== ")");
  c.parent();       // Pop to ArgList
  return args;
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt {
  switch(c.node.type.name) {
    case "ReturnStatement":
      c.firstChild();  // Focus return keyword
      c.nextSibling(); // Focus expression
      var value = traverseExpr(c, s);
      c.parent();
      return { tag: "return", value };
    case "AssignStatement":
      c.firstChild(); // go to name
      var name = s.substring(c.from, c.to);
      c.nextSibling(); // go to equals
      c.nextSibling(); // go to value
      var value = traverseExpr(c, s);
      c.parent();
      return {
        tag: "define",
        name: name,
        value: value
      }
    case "ExpressionStatement":
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return { tag: "expr", expr: expr }
    case "FunctionDefinition":
      c.firstChild();  // Focus on def
      c.nextSibling(); // Focus on name of function
      var name = s.substring(c.from, c.to);
      c.nextSibling(); // Focus on ParamList
      var parameters = traverseParameters(c, s)
      c.nextSibling(); // Focus on Body
      c.firstChild();  // Focus on :
      var body = [];
      while(c.nextSibling()) {
        body.push(traverseStmt(c, s));
      }
      console.log("Before pop to body: ", c.type.name);
      c.parent();      // Pop to Body
      console.log("Before pop to def: ", c.type.name);
      c.parent();      // Pop to FunctionDefinition
      return {
        tag: "fun",
        name, parameters, body
      }
    default:
      throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseParameters(c : TreeCursor, s : string) : Array<Parameter> {
  c.firstChild();  // Focuses on open paren
  const parameters = [];
  do {
    c.nextSibling(); // Focuses on a VariableName
    let name = s.substring(c.from, c.to);
    parameters.push({name});
    c.nextSibling(); // Focuses on either "," or ")"
  } while(c.type.name !== ")");
  c.parent();       // Pop to ParamList
  return parameters;
}

export function traverse(c : TreeCursor, s : string) : Array<Stmt> {
  switch(c.node.type.name) {
    case "Script":
      const stmts = [];
      c.firstChild();
      do {
        stmts.push(traverseStmt(c, s));
      } while(c.nextSibling())
      return stmts;
    default:
      throw new Error("Could not parse program at " + c.node.from + " " + c.node.to);
  }
}
export function parse(source : string) : Array<Stmt> {
  const t = parser.parse(source);
  return traverse(t.cursor(), source);
}
