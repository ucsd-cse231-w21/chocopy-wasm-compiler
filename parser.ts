import {parser} from "lezer-python";
import {Tree, TreeCursor} from "lezer-tree";
import {Program, Expr, Stmt, Op, Parameter, NUM, BOOL, NONE, OBJ, Type, FunDef, VarInit, Literal} from "./ast";

export function traverseLiteral(c : TreeCursor, s : string) : Literal {
  switch(c.type.name) {
    case "Number":
      return {
        tag: "num",
        value: Number(s.substring(c.from, c.to))
      }
    case "Boolean":
      return {
        tag: "bool",
        value: s.substring(c.from, c.to) === "True"
      }
    default:
      throw new Error("Not literal")
  }
}

export function traverseExpr(c : TreeCursor, s : string) : Expr {
  switch(c.type.name) {
    case "Number":
      return { 
        tag: "literal", 
        value: traverseLiteral(c, s)
      }
    case "Boolean":
      // TODO: add assert to be in [True, False]
      return {
        tag: "literal",
        value: traverseLiteral(c, s)
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
        case "//":
          op = Op.IDiv;
          break;
        case "%":
          op = Op.Mod;
          break
        case "==":
          op = Op.Eq;
          break;
        case "!=":
          op = Op.Neq;
          break;
        case "<=":
          op = Op.Lte;
          break;
        case ">=":
          op = Op.Gte;
          break;
        case "<":
          op = Op.Lt;
          break;
        case ">":
          op = Op.Gt;
          break;
        case "is":
          op = Op.Is;
          break; 
        case "and":
          op = Op.And;
          break;
        case "or":
          op = Op.Or;
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
  c.nextSibling();
  while(c.type.name !== ")") {
    let expr = traverseExpr(c, s);
    args.push(expr);
    c.nextSibling(); // Focuses on either "," or ")"
    c.nextSibling(); // Focuses on a VariableName
  } 
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
        tag: "assign",
        name: name,
        value: value
      }
    case "ExpressionStatement":
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return { tag: "expr", expr: expr }
    // case "FunctionDefinition":
    //   c.firstChild();  // Focus on def
    //   c.nextSibling(); // Focus on name of function
    //   var name = s.substring(c.from, c.to);
    //   c.nextSibling(); // Focus on ParamList
    //   var parameters = traverseParameters(c, s)
    //   c.nextSibling(); // Focus on Body or TypeDef
    //   let ret : Type = NONE;
    //   if(c.type.name === "TypeDef") {
    //     c.firstChild();
    //     ret = traverseType(c, s);
    //     c.parent();
    //   }
    //   c.firstChild();  // Focus on :
    //   var body = [];
    //   while(c.nextSibling()) {
    //     body.push(traverseStmt(c, s));
    //   }
    //   // console.log("Before pop to body: ", c.type.name);
    //   c.parent();      // Pop to Body
    //   // console.log("Before pop to def: ", c.type.name);
    //   c.parent();      // Pop to FunctionDefinition
    //   return {
    //     tag: "fun",
    //     name, parameters, body, ret
    //   }
    case "IfStatement":
      c.firstChild(); // Focus on if
      c.nextSibling(); // Focus on cond
      const cond = traverseExpr(c, s);
      console.log("Cond:", cond);
      c.nextSibling(); // Focus on : thn
      c.firstChild(); // Focus on :
      var thn = [];
      while(c.nextSibling()) {  // Focus on thn stmts
        thn.push(traverseStmt(c,s));
      }
      console.log("Thn:", thn);
      c.parent();
      
      c.nextSibling(); // Focus on else
      c.nextSibling(); // Focus on : els
      c.firstChild(); // Focus on :
      var els = [];
      while(c.nextSibling()) { // Focus on els stmts
        els.push(traverseStmt(c, s));
      }
      console.log("Els:", els);
      c.parent();
      c.parent();
      return {
        tag: "if",
        cond: cond,
        thn: thn,
        els: els
      }
    default:
      throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseType(c : TreeCursor, s : string) : Type {
  // For now, always a VariableName
  let name = s.substring(c.from, c.to);
  switch(name) {
    case "int": return NUM;
    case "bool": return BOOL;
    case "object": return OBJ;
  }
}

export function traverseParameters(c : TreeCursor, s : string) : Array<Parameter> {
  c.firstChild();  // Focuses on open paren
  const parameters = [];
  c.nextSibling(); // Focuses on a VariableName
  while(c.type.name !== ")") {
    let name = s.substring(c.from, c.to);
    c.nextSibling(); // Focuses on "TypeDef", hopefully, or "," if mistake
    let nextTagName = c.type.name; // NOTE(joe): a bit of a hack so the next line doesn't if-split
    if(nextTagName !== "TypeDef") { throw new Error("Missed type annotation for parameter " + name)};
    c.firstChild();  // Enter TypeDef
    c.nextSibling(); // Focuses on type itself
    let typ = traverseType(c, s);
    c.parent();
    c.nextSibling(); // Move on to comma or ")"
    parameters.push({name, type: typ});
    c.nextSibling(); // Focuses on a VariableName
  }
  c.parent();       // Pop to ParamList
  return parameters;
}

export function traverseInit(c : TreeCursor, s : string) : VarInit {
  c.firstChild(); // go to name
  var name = s.substring(c.from, c.to);
  c.nextSibling(); // go to : type

  if(c.type.name !== "TypeDef") {
    c.parent();
    throw Error("invalid variable init");
  }
  c.firstChild(); // go to :
  c.nextSibling(); // go to type
  const type = traverseType(c, s);
  c.parent();
  
  c.nextSibling(); // go to =
  c.nextSibling(); // go to value
  var value = traverseLiteral(c, s);
  c.parent();

  return { name, type, value }
}

export function traverseDef(c : TreeCursor, s : string) : FunDef {
  c.firstChild();  // Focus on def
  c.nextSibling(); // Focus on name of function
  var name = s.substring(c.from, c.to);
  c.nextSibling(); // Focus on ParamList
  var parameters = traverseParameters(c, s)
  c.nextSibling(); // Focus on Body or TypeDef
  let ret : Type = NONE;
  if(c.type.name === "TypeDef") {
    c.firstChild();
    ret = traverseType(c, s);
    c.parent();
    c.nextSibling();
  }
  c.firstChild();  // Focus on :
  var inits = [];
  var body = [];
  
  var hasChild = c.nextSibling();

  while(hasChild) {
    if (c.type.name === "AssignStatement") {
      try {
        inits.push(traverseInit(c, s));
      } catch (error) {
        break;
      }
    } else {
      break;
    }
    hasChild = c.nextSibling();
  }

  while(hasChild) {
    body.push(traverseStmt(c, s));
    hasChild = c.nextSibling();
  } 
  
  // console.log("Before pop to body: ", c.type.name);
  c.parent();      // Pop to Body
  // console.log("Before pop to def: ", c.type.name);
  c.parent();      // Pop to FunctionDefinition
  return { name, parameters, ret, inits, body }
}

export function traverse(c : TreeCursor, s : string) : Program {
  switch(c.node.type.name) {
    case "Script":
      const inits : Array<VarInit> = [];
      const funs : Array<FunDef> = [];
      const stmts : Array<Stmt> = [];
      var hasChild = c.firstChild();

      while(hasChild) {
        if (c.type.name === "AssignStatement") {
          try {
            inits.push(traverseInit(c, s));
          } catch (error) {
            break;
          }
        } else if (c.type.name === "FunctionDefinition") {
          funs.push(traverseDef(c, s));
        } else {
          break;
        }
        hasChild = c.nextSibling();
      }
      console.log("POST:", s.substring(c.from, c.to));
      while(hasChild) {
        stmts.push(traverseStmt(c, s));
        hasChild = c.nextSibling();
      } 
      return { funs, inits, stmts };
    default:
      throw new Error("Could not parse program at " + c.node.from + " " + c.node.to);
  }
}
export function parse(source : string) : Program {
  const t = parser.parse(source);
  return traverse(t.cursor(), source);
}
