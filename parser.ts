import {parser} from "lezer-python";
import {TreeCursor} from "lezer-tree";
import {ClassDef, Expr, FuncBody, FuncDef, PreDef, Program, Stmt, TypedVar, VarDef} from "./ast";

export function traverseExpr(c : TreeCursor, s : string) : Expr {
  switch(c.type.name) {
    case "Number": {
      return {
        tag: "literal",
        value: {tag: "number", value: Number(s.substring(c.from, c.to))},
        cursor: c.node,
        type: null,
      }
    }
    case "Boolean": {
      let v = s.substring(c.from, c.to);
      if ((v !== "True") && (v !== "False")) {
        throw new Error("Unknown boolean");
      }
      return {
        tag: "literal",
        value: {tag: v},
        cursor: c.node,
        type: null,
      }
    }
    case "None": {
      let v = s.substring(c.from, c.to);
      if (v !== "None") {
        throw new Error("Unknown None");
      }
      return {
        tag: "literal",
        value: {tag: v},
        cursor: c.node,
        type: null,
      }
    }
    case "self": {
      return {
        tag: "id",
        name: s.substring(c.from, c.to),
        cursor: c.node,
        type: null,
        funcType: null,
        classType: null,
      }
    } 
    case "VariableName": {
      return {
        tag: "id",
        name: s.substring(c.from, c.to),
        cursor: c.node,
        type: null,
        funcType: null,
        classType: null,
      }
    } 
    case "ParenthesizedExpression": {
      c.firstChild();
      c.nextSibling();
      const expr = traverseExpr(c, s);
      c.parent();
      return expr;
    }
    case "UnaryExpression": {
      c.firstChild();
      const op = s.substring(c.from, c.to);
      c.nextSibling();
      const expr = traverseExpr(c, s);
      c.parent();
      return {
        tag: "unaryop", 
        op, expr,
        cursor: c.node,
        type: null,
      }
    }
    case "BinaryExpression": {
      c.firstChild();
      const expr1 = traverseExpr(c, s);
      // console.log(s.substring(c.from, c.to));
      c.nextSibling();
      // console.log(s.substring(c.from, c.to));
      const op = s.substring(c.from, c.to);
      c.nextSibling();
      // console.log(s.substring(c.from, c.to));
      const expr2 = traverseExpr(c, s);
      c.parent();
      return {
        tag: "binaryop", 
        expr1, expr2, op,
        cursor: c.node,
        type: null,
      }
    }
    case "MemberExpression": {
      c.firstChild();
      const owner = traverseExpr(c, s);
      c.nextSibling();  // .
      c.nextSibling();
      const property = s.substring(c.from, c.to);
      c.parent();
      return {
        tag: "member",
        owner, property,
        cursor: c.node,
        type: null,
        funcType: null,
        classType: null,
      }
    }
    case "CallExpression": {
      c.firstChild();
      const caller = traverseExpr(c, s);
      c.nextSibling(); // go to arglist
      c.firstChild(); // go into arglist
      const args = [];
      while (c.nextSibling() && c.node.type.name !== ")") {
        args.push(traverseExpr(c, s));
        c.nextSibling(); 
      }
      c.parent(); // pop arglist
      c.parent(); // pop CallExpression
      return {
        tag: "call", 
        caller, args,
        cursor: c.node,
        type: null,
      };
    }
    default:
      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt {
  // { tag: "assign", name: VarName, value: Expr }
  // | { tag: "if", exprs: Array<Expr>, stmts: Array<Array<Stmt>> }
  // | { tag: "while", expr: Expr, stmts: Array<Stmt> }
  // | { tag: "pass" }
  // | { tag: "return", expr: Expr }
  // | { tag: "expr", expr: Expr }
  switch(c.node.type.name) {
    case "AssignStatement": {
      if ((c.node.firstChild && c.node.firstChild.nextSibling && c.node.firstChild.nextSibling.type.name === "TypeDef")) {
        throw new Error("Unexpected init at " + c.node.from + " " + c.node.to);
      }
      c.firstChild(); // go to name
      const name = traverseExpr(c, s);
      c.nextSibling(); // go to equals
      c.nextSibling(); // go to value
      const value = traverseExpr(c, s);
      c.parent();
      return {
        tag: "assign", 
        name, value,
        cursor: c.node,
        type: null,
      }
    }
      
    case "IfStatement": {
      const exprs = [];
      const blocks = [];
      c.firstChild();  // if
      c.nextSibling();  // expr
      exprs.push(traverseExpr(c, s));
      c.nextSibling();  // Body
      c.firstChild();  // :

      let stmts = [];
      while (c.nextSibling()) {
        stmts.push(traverseStmt(c, s));
      } 
      blocks.push(stmts);
      c.parent();  // Body

      while (c.nextSibling() && c.type.name === "elif") {
        c.nextSibling();
        exprs.push(traverseExpr(c, s));
        c.nextSibling();  // Body
        let stmts = [];
        c.firstChild();
        c.nextSibling(); 
        do {
          stmts.push(traverseStmt(c, s));
        } while (c.nextSibling());
        blocks.push(stmts);
        c.parent();
      }

      if (c.type.name === "else") {
        c.nextSibling();  // Body
        let stmts = [];
        c.firstChild();  // :
        c.nextSibling();  
        do {
          stmts.push(traverseStmt(c, s));
        } while (c.nextSibling());
        blocks.push(stmts);
        c.parent();
      }
      c.parent();  // IfStatement
      
      return {
        tag: "if", 
        exprs, blocks,
        cursor: c.node,
        type: null,
      }
    }
      
    case "WhileStatement": {
      c.firstChild();  // while
      c.nextSibling();  // expr
      const expr = traverseExpr(c, s);
      c.nextSibling();  // Body
      c.firstChild();
      c.nextSibling();
      const stmts = [];
      do {
        stmts.push(traverseStmt(c, s));
      } while (c.nextSibling())
      c.parent();  // Body
      c.parent();  // WhileStatement
      return {
        tag: "while", 
        expr, stmts,
        cursor: c.node,
        type: null,
      };
    }
    case "PassStatement": {
      return {
        tag: "pass",
        cursor: c.node,
        type: null,
      }
    }
    case "ReturnStatement": {
      c.firstChild();  // return
      c.nextSibling();
      const expr = traverseExpr(c, s);
      c.parent();
      return {
        tag: "return", 
        expr,
        cursor: c.node,
        type: null,
      };
    }
    case "ExpressionStatement": {
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent();
      if (expr.tag === "call" && expr.caller.tag === "id" && expr.caller.name === "print") {
        if (expr.args.length !== 1) {
          // TODO: error
        }
        return {
          tag: "print",
          expr: expr.args[0],
          cursor: c.node,
          type: null,
        }
      }

      return { 
        tag: "expr", 
        expr,
        cursor: c.node,
        type: null,
      }
    }
      
    default: {
      throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
    }
  }
}

// offset, len, 

export function traverseTypedVar (c : TreeCursor, s : string) : TypedVar {
  const name = s.substring(c.from, c.to);
  c.nextSibling();
  if (c.type.name !== "TypeDef") {
    throw new Error("Expect TypeDef at " + c.node.from + " " + c.node.to);
  }
  c.firstChild();
  c.nextSibling();
  const type = s.substring(c.from, c.to);
  c.parent();

  return { name, type };
}

export function traverseVarDef(c : TreeCursor, s : string) : VarDef {
  c.firstChild();
  const tvar = traverseTypedVar(c, s);
  c.nextSibling();  // AssignOp
  c.nextSibling();
  const value = s.substring(c.from, c.to);
  
  if (c.node.type.name === "Number") {
    c.parent();
    return {
      tvar: tvar, 
      value:{tag: "number", value: Number(value)}
    };
  }
  if (value !== "None" && value !== "True" && value !== "False") {
    throw new Error("Expect number/None/True/False at " + c.node.from + " " + c.node.to);
  }
  c.parent();
  return {
    tvar: tvar, 
    value: {tag: value}
  };
}

export function traverseFuncBody(c : TreeCursor, s : string) : FuncBody {
  c.firstChild();
  c.nextSibling();
  const [defs, end] = traverseDefs(c, s);
  const stmts: Array<Stmt> = [];
  if (!end) {
    return {defs, stmts};
  }
  do {
    stmts.push(traverseStmt(c, s));
  } while(c.nextSibling())
  c.parent();
  return {defs, stmts};
}

export function traverseFuncDef(c : TreeCursor, s : string) : FuncDef {
  c.firstChild();  // def
  c.nextSibling();  // VariableName
  const name = s.substring(c.from, c.to);
  const params = [];
  c.nextSibling();  // ParamList
  c.firstChild();  // (
  c.nextSibling();  // VariableName
  while (c.node.type.name != ")") {
    params.push(traverseTypedVar(c, s))
    c.nextSibling();  // , | )
    c.nextSibling();
  }
  c.parent();  // ParamList
  c.nextSibling();  // TypeDef or Body

  let retType = "<None>";
  if (c.type.name === "TypeDef") {
    c.firstChild();  // VariableName
    retType = s.substring(c.from, c.to);
    c.parent();  // TypeDef
    c.nextSibling();  // Body
  }
  const body = traverseFuncBody(c, s);
  c.parent();

  return { name, params, retType, body };
}

export function traverseClassDef(c : TreeCursor, s : string): ClassDef {
  c.firstChild();  // class
  c.nextSibling();  // VariableName
  const name = s.substring(c.from, c.to);
  
  // TODO: assert one parent
  c.nextSibling();  // ArgList
  c.firstChild();  // LPAREN
  c.nextSibling();  // VariableName
  const parent = s.substring(c.from, c.to);
  c.parent();  // ArgList
  c.nextSibling();  // Body
  c.firstChild();  // :
  c.nextSibling();
  
  const [defs, end] = traverseDefs(c, s);

  c.parent();  // Body
  c.parent();  // ClassDefinition

  return {name, parent, defs};
}

export function traverseDefs(c : TreeCursor, s : string) : [PreDef, boolean] {
  const varDefs: Array<VarDef> = [];
  const funcDefs: Array<FuncDef> = [];
  const classDefs: Array<ClassDef> = [];
  let end = false;
  do {
    switch(c.node.type.name) {
      case "FunctionDefinition":
        funcDefs.push(traverseFuncDef(c, s));
        break;
      case "AssignStatement":
        if (!(c.node.firstChild && c.node.firstChild.nextSibling && c.node.firstChild.nextSibling.type.name === "TypeDef")) {
          end = true;
          break;
        }
        varDefs.push(traverseVarDef(c, s));
        break;
      case "ClassDefinition":
        classDefs.push(traverseClassDef(c, s));
        break;
      default:
        end = true;
        break;
    }
  } while(!end && c.nextSibling())
  
  return [{varDefs, funcDefs, classDefs}, end]
}

export function traverse(c : TreeCursor, s : string) : Program {
  switch(c.node.type.name) {
    case "Script":
      c.firstChild();
      const [defs, end] = traverseDefs(c, s);
      const stmts: Array<Stmt> = [];
      if (!end) {
        return {defs, stmts};
      }
      do {
        stmts.push(traverseStmt(c, s));
      } while(c.nextSibling())
      console.log("traversed " + stmts.length + " statements ", stmts, "stopped at " , c.node);
      return {defs, stmts};
    default:
      throw new Error("Could not parse program at " + c.node.from + " " + c.node.to);
  }
}

export function parse(source : string) : Program {
  const t = parser.parse(source);
  return traverse(t.cursor(), source);
}
