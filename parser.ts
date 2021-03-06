// -*- mode: typescript; typescript-indent-level: 2; -*-

import { parser } from "lezer-python";
import { TreeCursor } from "lezer-tree";
import { Name, Function, Expr, Stmt, Parameter, Pos, Branch, Type, NoneT, StrT, BoolT, IntT } from "./ast";
import * as err from "./error";
import { tr } from "./common";

export function getSourcePos(c : TreeCursor, s : string) : Pos {
  const substring = s.substring(0, c.node.to);
  const line = substring.split("\n").length;
  const prevContent = substring.split("\n").slice(0, line-1).join("\n");
  const col = c.node.from - prevContent.length
  
  return {
    line: line,
    col: col,
    len: c.node.to - c.node.from 
  }
}

export function traverseExpr(c : TreeCursor, s : string) : Expr {
  switch(c.type.name) {
    case "Boolean":
      const boolPos = getSourcePos(c, s);
      var value = false;
      
      if (s.substring(c.from, c.to) == "True") {
        value = true;
      } else if (s.substring(c.from, c.to) == "True") {
        value = false;
      }

      return {
        tag: "bool",
	pos: boolPos,
        value: value
      }
    case "Number":
      const numPos = getSourcePos(c, s);
      return {
        tag: "num",
	pos: numPos,
        value: Number(s.substring(c.from, c.to))
      }
    case "None":
      const nonePos = getSourcePos(c, s);
      return {
	tag: "none",
	pos: nonePos
      }
    case "VariableName":
      const idPos = getSourcePos(c, s);
      
      return {
        tag: "id",
	pos: idPos,
	name: s.substring(c.from, c.to)
      }
    case "self":
      return {
	tag: "self",
	pos: getSourcePos(c, s)
      }
    case "String":
      return {
	tag: "string",
	value: s.substring(c.node.from+1, c.node.to-1),
	pos: getSourcePos(c, s)
      }
    case "MemberExpression":
      const pos = getSourcePos(c, s);
      
      c.firstChild();
      
      const lhsExpr = traverseExpr(c, s);

      c.nextSibling();

      switch (s.substring(c.from, c.to)) {
	case ("."):
	  c.nextSibling();

	  const memStr = s.substring(c.from, c.to);
	  const memPos = getSourcePos(c, s);

	  c.parent();

	  return {
	    tag: "memExp",
	    pos: pos,
	    expr: lhsExpr,
	    member: { str: memStr, pos: memPos}
	  };
	case ("["):
	  c.nextSibling();

	  var args: Expr[] = [traverseExpr(c, s)];
	  
	  c.nextSibling();

	  while (c.node.type.name != ']') {
	    c.nextSibling(); // Skip the colon
	    args.push(traverseExpr(c, s));

	    c.nextSibling();
	  }

	  c.parent();

	  return {
	    tag: "intervalExp",
	    expr: lhsExpr,
	    pos: pos,
	    args: args,
	  }
      }
    case "CallExpression":
      const cExpPos = getSourcePos(c, s);
      
      c.firstChild();
      const callName = traverseExpr(c, s);
      c.nextSibling(); // go to arglist

      const prmPos = getSourcePos(c, s);
      
      c.firstChild();  // go into arglist
      c.nextSibling(); // find single argument in arglist

      var args: Array<Expr> = [];
      var prmsPosArr: Array<Pos> = [];
      
      if (s.substring(c.node.from, c.node.to) != ")") {
	args = [traverseExpr(c, s)];
	prmsPosArr = [getSourcePos(c, s)];
	c.nextSibling();
	
	while (c.node.type.name != ')') {
      	  c.nextSibling(); // pop the comma
	  
	  args.push(traverseExpr(c, s));
	  prmsPosArr.push(getSourcePos(c, s));
	  c.nextSibling();
	}
      }
      c.parent(); // pop arglist
      c.parent(); // pop CallExpression
      
      return {
        tag: "funcCall",
	pos: cExpPos,
	prmPos: prmPos,
	prmsPosArr: prmsPosArr,
        name: callName,
        args: args
      };
    case "UnaryExpression":
      const uExpPos = getSourcePos(c, s);
      
      c.firstChild();

      const uop = s.substring(c.from, c.to);
      c.nextSibling();
      const uArg = traverseExpr(c, s);

      // Pop the expr
      c.parent();
      
      return {
	tag: "unaryExp",
	pos: uExpPos,
	name: uop,
	arg: uArg
      };
      
    case "BinaryExpression":
      const binExpPos = getSourcePos(c, s);
      
      c.firstChild();

      const leftArg  = traverseExpr(c, s);
      c.nextSibling();
      const op       = s.substring(c.from, c.to);
      c.nextSibling();
      const rightArg = traverseExpr(c, s);

      // Pop the expr
      c.parent();
      
      return {
	tag: "binExp",
	pos: binExpPos,
	name: op,
	arg: [leftArg, rightArg]
      };
    case "ParenthesizedExpression":
      c.firstChild();

      c.nextSibling(); // Skip the opening paren
      const expr = traverseExpr(c, s);
      c.parent();
      
      return expr;
    default:
      err.parseError(getSourcePos(c, s), `Parser failed (miserably), could not parse the expression.`, s); 
  }
}

export function parseType(source: string, typeStr : string, pos: Pos) : Type {
  switch (typeStr) {
    case "bool":
      return BoolT;
    case "str":
      return StrT;
    case "int":
      return IntT;
    case "None":
      return NoneT;
    default:
      return { tag: "class", name: typeStr };
  }
}

export function traverseClass(c: TreeCursor, s: string): Stmt {
  c.firstChild(); // Descend into class definition
  c.nextSibling(); // Skip 'class' keyword

  const className = s.substring(c.node.from, c.node.to);
  const classNamePos = getSourcePos(c, s);
  
  var inherits: Array<Name> = [];
  c.nextSibling();
  
  if (c.node.type.name == "ArgList") {
    c.firstChild(); // Descend into the inheritance list

    while (c.nextSibling()) { /* Skips the opening brace on first run */
      inherits.push({ str: s.substr(c.node.from, c.node.to), pos: getSourcePos(c, s) });
      c.nextSibling(); // Skip the comma or the closing brace
    }

    c.parent();
    c.nextSibling();
  }

  c.firstChild(); // Get the first child
  c.nextSibling(); // Skip the ':'
  
  var body: Array<Stmt>  = []; // Get all the statements in the body
  do {
    body.push(traverseStmt(c, s));
  } while (c.nextSibling());

  var iVars: Array<Stmt> = [];
  var funcs: Array<Function> = [];

  
  body.forEach(bStmt => {
    switch (bStmt.tag) {
      case "define":
	iVars.push(bStmt);
	break;
      case "func":
	funcs.push(bStmt.content);
	break;
      default:
	// err.scopeError({line: 0, col: 0, len: 0}, `Can't have ${bStmt.tag} in a class defintion.`, s);
	break;
    }
  });

  c.parent();
  c.parent();
  
  const result: Stmt = {
    tag: "class",
    name: { str: className, pos: classNamePos },
    body: {
      iVars: iVars,
      inherits: inherits,
      funcs: funcs
    }
  }

  return result;  
}

export function traverseFunction(c: TreeCursor, s: string) : Stmt {
  c.firstChild(); // Descend to the function
  c.nextSibling(); // Skip the 'def' keyword

  const funName: Name = {
    str: s.substring(c.node.from, c.node.to),
    pos: getSourcePos(c, s)
  };

  c.nextSibling(); // Skip to the parameter list
  c.firstChild(); // Descend to the variable list
  c.nextSibling(); // Skip the opening paren

  var paramList : Array<Parameter> = [];
  var iter = 0;
  while (s.substring(c.node.from, c.node.to) != ")") {
    iter+=1;
    if (iter > 10) {
      break;
    }
    var varName = s.substring(c.node.from, c.node.to);
    c.nextSibling(); // go to the typedef
    c.firstChild(); // descend to the typedef
    c.nextSibling(); // Skip the colon

    const paramTypeStr = s.substring(c.node.from, c.node.to);
    const paramTypePos = getSourcePos(c, s);
    const paramType: Type = parseType(s, paramTypeStr, paramTypePos);

    c.parent();

    paramList = paramList.concat({
      tag: "parameter",
      name: varName,
      type: paramType,
    });

    c.nextSibling(); // go to the next token (',', ')')
    
    // Check if the next token is a comma
    if (s.substring(c.node.from, c.node.to) == ",") {
      c.nextSibling(); // Skip it
    } 
    
  };

  c.parent(); // Get out of the parameter list
  const parametersPos = getSourcePos(c, s);
  var retPos: Pos = getSourcePos(c, s);   // Make return's position
					  // same as the parameters
					  // incase the function
					  // doesn't have any explicit
					  // return type
  
  c.nextSibling(); // Go to the function's typedef

  var retType: Type = NoneT;
  if (c.node.name != "Body") {
    c.firstChild();
    retType = parseType(s, s.substring(c.node.from, c.node.to), getSourcePos(c, s));
    retPos = getSourcePos(c, s);
    c.parent(); // Go back to the function
  }
  
  c.nextSibling(); // Get to the function body
  c.firstChild();
  c.nextSibling(); // Skip the colon in the body

  var bodyStmts: Array<Stmt> = [];
  do {
    bodyStmts.push(traverseStmt(c, s));
  } while(c.nextSibling());
  
  c.parent();
  c.parent();
  
  const resultVal: Stmt = {
    tag: "func",
    content: {
      pos: getSourcePos(c, s),
      name: funName,
      parameters: paramList,
      parametersPos: parametersPos,
      ret: retType,
      retPos: retPos,
      body: bodyStmts
    }
  }

  return resultVal;
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt {
  switch(c.node.type.name) {
    case "Comment":
      return {
	tag: "comment",
	pos: getSourcePos(c, s)
      };
    case "PassStatement":
      return { tag: "pass", pos: getSourcePos(c, s) };
    case "ClassDefinition":
      return traverseClass(c, s);
    case "FunctionDefinition":
      return traverseFunction(c, s);
    case "IfStatement":

      c.firstChild(); // go to if
      c.nextSibling(); // go to the condition
      const condPos = getSourcePos(c, s);
      const cond = traverseExpr(c, s);

      c.nextSibling(); // go to the if body
      c.firstChild(); // descend into the body
      c.nextSibling(); // Skip the colon
            
      var ifBody: Array<Stmt> = [];
      do {
	ifBody = ifBody.concat(traverseStmt(c, s));
      } while (c.nextSibling());

      c.parent();

      var elseBody : Array<Stmt> = [];
      var branches : Array<Branch> = [];
      
      
      // Check for elif/else
      while (c.nextSibling()) {
      	const branchName = s.substring(c.node.from, c.node.to)
	
	switch (branchName) {
	  case "else":
	    
	    c.nextSibling(); // Skip the keyword
	    c.firstChild(); // Get to the body
	    c.nextSibling(); // Skip the colon
	    
	    do {
	      elseBody = elseBody.concat(traverseStmt(c, s));
	    } while (c.nextSibling());

	    c.parent();
	    break;
	  case "elif":
	    c.nextSibling(); // Skip the keyword
   
	    const condPos : Pos = getSourcePos(c, s);
	    const cond : Expr = traverseExpr(c, s);
	    var elifBody : Array<Stmt> = [];

	    c.nextSibling(); 

	    c.firstChild(); // Get to the body
	    c.nextSibling(); // Skip the colon

	    do {
	      elifBody = elifBody.concat(traverseStmt(c, s));
	    } while (c.nextSibling());

	    c.parent();

	    const entry : Branch = {
	      tag: "branch",
	      cond: cond,
	      condPos: condPos,
	      body: elifBody
	    };
	    
	    branches.push(entry);
	    
	    break;
	}
      }

      
      const result: Stmt = {
	tag: "if",
	condPos: condPos,
	cond: cond,
	ifBody: ifBody,
	branches: branches,
	elseBody: elseBody
      }

      c.parent();

      return result;
      
    case "AssignStatement":
      const assignPos = getSourcePos(c, s);
      
      c.firstChild(); // go to name
      
      const lhs = traverseExpr(c, s);
      
      c.nextSibling(); // go to colon

      var staticType: Type = undefined;
      if (s.substring(c.from, c.from+1) == ':') {
	const staticTypeStr = s.substring(c.from, c.to).replace(":", "").trim();
	const staticTypePos = getSourcePos(c, s);

	staticType = parseType(s, staticTypeStr, staticTypePos);
	
      }
      
      c.nextSibling(); // go to equals
      c.nextSibling(); // go to value

      const value = traverseExpr(c, s);
      c.parent();

      if (staticType != undefined && lhs.tag == "id") {
	return {
          tag: "define",
	  pos: assignPos,
	  staticType: staticType,
          name: { str: lhs.name, pos: lhs.pos },
          value: value
	}
      } else {
	return {
	  tag: "assign",
	  pos: assignPos,
	  lhs: lhs,
	  value: value
	}
      }
    case "WhileStatement":
      c.firstChild();
      c.nextSibling(); // Skip the while keyword

      const condExpr = traverseExpr(c, s);
      c.nextSibling(); // Go to the body

      c.firstChild();
      c.nextSibling();
      
      var whileBody: Array<Stmt> = [];
      do {
	whileBody = whileBody.concat(traverseStmt(c, s));
      } while (c.nextSibling());
      
      c.parent();
      c.parent();

      return {
	tag: "while",
	cond: condExpr,
	whileBody: whileBody
      };

    case "ForStatement":
      c.firstChild();
      c.nextSibling(); // Skip the for keyword

      const varName = s.substring(c.node.from, c.node.to);
      const varPos = getSourcePos(c, s);
      
      c.nextSibling(); // Go to in keyword
      c.nextSibling(); // Skip the in keyword

      const str: Expr = traverseExpr(c, s);

      c.nextSibling(); // Go to the body

      c.firstChild();
      c.nextSibling();

      var forBody: Array<Stmt> = [];
      do {
	forBody = forBody.concat(traverseStmt(c, s));
      } while (c.nextSibling());

      c.parent();
      c.parent();
      
      return {
	tag: "for",
	str: str,
	varName: {str: varName, pos: varPos },
	body: forBody
      }
    case "ExpressionStatement":
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return { tag: "expr", expr: expr }
    case "ReturnStatement":
      c.firstChild();
      var retExpr: Expr = undefined;

      if (c.nextSibling() != undefined) { // Skip 'return'
	retExpr = traverseExpr(c, s);
      }
      c.parent();
      return { tag: "return", pos: getSourcePos(c, s), expr: retExpr };
    default:
      err.typeError(getSourcePos(c, s), `Could not parse stmt, failed miserably`, s);
  }
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
  const ast = traverse(t.cursor(), source);
  return ast;
}
