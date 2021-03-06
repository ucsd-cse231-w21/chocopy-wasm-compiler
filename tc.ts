// -*- mode: typescript; typescript-indent-level: 2; -*-

import { internalError, typeError, symLookupError, argError, scopeError, parseError } from './error';
import { GlobalEnv, ClassEnv, FuncEnv } from "./env";
import { Type, Value, Expr, Stmt, Parameter, Pos, Branch, ClassT, BoolT, IntT, StrT, NoneT } from "./ast";
import { tr, eqT, neqT, canAssignNone } from "./common"

export type EnvType = Record<string, Type>;
export var env : EnvType = {};

function assert_itype(expr: Expr): Expr {
  if (expr.iType == undefined) {
    internalError();
  }

  return expr;
}

export function
tc_binExp(pos: Pos, op : string, leftType : Type, rightType : Type, source: string) : Type {
  switch (op) {
    case "-":
    case "%":
    case "//":
      if (leftType != IntT || rightType != IntT) {
	const errMsg = `Operator ${op} expects both args to be int, got ${tr(leftType)} `
	  + `and ${tr(rightType)}`;
	typeError(pos, errMsg, source);
      }
      return IntT;
    case "*":
      if ((leftType != IntT && leftType != StrT) || rightType != IntT) {
	const errMsg = `Operator ${op} expects first expression to be either string or int, and`
	  + ` second expression to be int, got ${tr(leftType)} and ${tr(rightType)}`;
	typeError(pos, errMsg, source);
      }
      return leftType;
    case "+":
      if ((leftType != rightType) || (leftType != StrT && leftType != IntT)) {
	const errMsg = `Operator ${op} expects both args to be either int or str, got ${tr(leftType)} `
	  + `and ${tr(rightType)}`;
	typeError(pos, errMsg, source);
      }
      return leftType;
    case ">=":
    case "<=":
    case ">":
    case "<":
    case "==":
    case "!=":
      if (leftType != rightType) {
	typeError(pos, `Operator ${op} on types that are neither both int nor bool (${tr(leftType)}`
	  + ` and ${tr(rightType)})`, source);
      }
      return BoolT;
    case "is":
      if (!canAssignNone(leftType) || neqT(rightType, NoneT)) {
	typeError(pos, `Operator \`is\` used on non-None types, ${tr(leftType)} and ${tr(rightType)}`,
		  source);
      }
      return BoolT;
    case "and":
    case "or":
      if (leftType != BoolT || rightType != BoolT) {
	typeError(pos, `Operator ${op} used on non-bool types, ${tr(leftType)} and ${tr(rightType)}`,
		  source);
      }
      return BoolT;
    default:
      throw "Unknown operator " + op;
  }
}

export function
tc_uExp(pos: Pos, op: string, exprType: Type, source: string) {
  switch (op) {
    case "-":
      if (exprType != IntT) {
	typeError(pos, `Cannot use unary operator '-' with ${tr(exprType)}`, source);
      }
      break;
    case "not":
      if (exprType != BoolT) {
	typeError(pos, `Cannot use unary operator 'not' with ${tr(exprType)}`, source);
      }
      break;
  }
}

export function
tc_for(stmt: Stmt, source: string, gblEnv: GlobalEnv, funEnv: EnvType = <EnvType>{},
	classEnv: Type = undefined) : [Stmt, Type] {
  if (stmt.tag == "for") {
    const iterTypeExpr: Expr = {tag: "id", name: stmt.varName.str, pos: stmt.varName.pos};
    const iterTypeExprTC = tc_expr(iterTypeExpr, source, gblEnv, funEnv, classEnv);
    const iterType = iterTypeExprTC[1];
    
    if (neqT(iterType, StrT)) {
      typeError(stmt.varName.pos, `While condition expected a str, found ${tr(iterType)}.`,
		source);
    }

    // Check the body
    stmt.body = stmt.body.map(s => {
      const res = tc_stmt(s, source, gblEnv, funEnv, classEnv);
      return res[0];
    });
    
    return [stmt, NoneT];
  } else {
    internalError();
  }    
}

export function
tc_class(stmt: Stmt, source: string, gblEnv: GlobalEnv, funEnv: EnvType = <EnvType>{}) : [Stmt, Type] {
  if (stmt.tag == "class") {
    const classEnv: Type = {tag: "class", name: stmt.name.str};

    var foundCtor = false;
    var nameMap: Record<string, Pos> = {}

    /* Type check variable declarations */
    stmt.body.iVars = stmt.body.iVars.map(ivar => {
      if (ivar.tag == "define") {
	const rhsTExpr = tc_expr(ivar.value, source, gblEnv, funEnv, classEnv);
	ivar.value = rhsTExpr[0];
	
	const lhsT = ivar.staticType;
	const rhsT = rhsTExpr[1];
	
	if (neqT(lhsT, rhsT) && (neqT(rhsT, NoneT) || !canAssignNone(lhsT))) {
	  typeError(ivar.pos, `Cannot assign value of type ${rhsT} to ${ivar.name} which is of type `
	    + `${lhsT}.`, source);
	}

	if (ivar.staticType == NoneT) {
	  typeError(ivar.pos, `Variable cannot be of type ${tr(ivar.staticType)}.`, source);
	}

	return ivar;
      }
    });
    
    stmt.body.funcs = stmt.body.funcs.map(f => {
      if (f.name.str == '__init__') { /* Constructor for the class */
	foundCtor = true;

	if (f.parameters.length != 1) {
	  argError(f.parametersPos, `Constructor should only have self as its argument`, source);
	}

	if (f.ret.tag != "none") {
	  typeError(f.retPos, `Constructor cannot have an explicit return type`, source);
	}
      }

      /* Check for duplicate functions */
      const prevPos = nameMap[f.name.str];
      if (prevPos != undefined) {
	scopeError(f.name.pos, `Function redefined in the same class, first defined at `
	  + `Line ${prevPos.line}`, source);
      }
      nameMap[f.name.str] = f.name.pos;
      
      /* Typecheck function's content */
      const fStmt: Stmt = {tag: "func", content: f};

      const fStmtRes = tc_func(fStmt, source, gblEnv, funEnv, classEnv)[0];
      
      if (fStmtRes.tag == "func") {
	f = fStmtRes.content;
      } else {
	internalError();
      }

      return f;
    });

    return [stmt, {tag: "class", name: stmt.name.str}];
  } else {
    internalError();
  }
}

export function
tc_func(stmt: Stmt, source: string, gblEnv: GlobalEnv, funEnv: EnvType = <EnvType>{},
	classEnv: Type = undefined) : [Stmt, Type] {
  if (stmt.tag == "func") {
    stmt.content.body.forEach(s => {
      if (s.tag == "define") {
	funEnv[s.name.str] = s.staticType;
      }
    });
    
    stmt.content.parameters.forEach(param => { funEnv[param.name] = param.type; });

    // TODO: Add support for checking for return statements in all the possible paths
    
    stmt.content.body = stmt.content.body.map(s => {
      s = tc_stmt(s, source, gblEnv, funEnv, classEnv)[0];
      if (s.tag == "return") {
	const retTypeExpr = tc_expr(s.expr, source, gblEnv, funEnv, classEnv);
	const retType = retTypeExpr[1];
	
	if (neqT(retType, stmt.content.ret)
	    && (neqT(retType, NoneT) || !canAssignNone(stmt.content.ret))) {
	  const throwMsg = `Return's type ${tr(retType)} and function's return type `
	    + `${tr(stmt.content.ret)} don't match`;
	  typeError(s.pos, throwMsg, source);
	}
      }

      return s;
    });

    return [stmt, NoneT];
  } else {
    internalError();
  }
}

export function
tc_stmt(stmt: Stmt, source: string, gblEnv: GlobalEnv, funEnv: EnvType = <EnvType>{},
	classEnv: Type = undefined) : [Stmt, Type] {
  switch (stmt.tag) {
    case "for":
      return tc_for(stmt, source, gblEnv, funEnv, classEnv);
    case "class":
      return tc_class(stmt, source, gblEnv, funEnv);
    case "expr":
      const expr = tc_expr(stmt.expr, source, gblEnv, funEnv, classEnv);
      stmt.expr = expr[0];
      return [stmt, expr[1]];
    case "pass":
      return [stmt, NoneT];
    case "define":
      const rhsTypeExpr = tc_expr(stmt.value, source, gblEnv, funEnv, classEnv);

      stmt.value = rhsTypeExpr[0];
      
      const rhsType = rhsTypeExpr[1];
      const lhsType = stmt.staticType;

      if (neqT(rhsType, lhsType) && (neqT(rhsType, NoneT) || !canAssignNone(lhsType))) {
	const errMsg = `${tr(rhsType)} value assigned to '${stmt.name.str}' which is of `
	  + `type ${tr(lhsType)}`;
	typeError(stmt.pos, errMsg, source);
      }

      if (eqT(lhsType, NoneT)) {
	typeError(stmt.pos, `Variable cannot be of type None`, source);
      }

      env[stmt.name.str] = stmt.staticType;
      
      return [stmt, stmt.staticType];
    case "assign":
      const assignRhsTypeExpr = tc_expr(stmt.value, source, gblEnv, funEnv, classEnv);
      const assignRhsType = assignRhsTypeExpr[1];

      stmt.value = assignRhsTypeExpr[0];
      
      if (stmt.lhs.tag == "id") {
	if (env[stmt.lhs.name] == undefined) {
	  symLookupError(stmt.lhs.pos, `Cannot find value '${stmt.lhs.name}' in current scope`,
			 source);
	}
	const assignLhsPos: Pos = stmt.lhs.pos;
	const assignLhsExpr: Expr = { tag: "id", pos: assignLhsPos, name: stmt.lhs.name };
	const assignLhsTypeExpr = tc_expr(assignLhsExpr, source, gblEnv, funEnv, classEnv);
	const assignLhsType = assignLhsTypeExpr[1];
	
	if (neqT(assignLhsType, assignRhsType)
	    && (neqT(assignRhsType, NoneT) || !canAssignNone(assignLhsType))) {
	  const errMsg = `Value of type ${tr(assignRhsType)} to '${stmt.lhs.name}' which is of `
	    + `type ${tr(assignLhsType)}`;
	  typeError(stmt.pos, errMsg, source);
	}

	stmt.lhs.iType = assignLhsType;
      } else if (stmt.lhs.tag == "memExp") {
	const exprTExpr = tc_expr(stmt.lhs.expr, source, gblEnv, funEnv, classEnv);
	stmt.lhs.expr = exprTExpr[0];
	
	const exprT = exprTExpr[1]
	
	if (exprT.tag == "class") {
	  const classRef: ClassEnv = gblEnv.classes.get(exprT.name);
	  const memRef = classRef.memberVars.get(stmt.lhs.member.str);

	  if (memRef == undefined) {
	    scopeError(stmt.lhs.member.pos, `${stmt.lhs.member.str} is not a member of `
	      + `type ${exprT.name}`, source);
	  }
	  stmt.lhs.iType = memRef[1];
	} else {
	  typeError(stmt.lhs.pos, `Member expression (${stmt.lhs.member.str}) on a non-object `
	    + `type (${tr(exprT)}).`, source);
	}

      }
      return [stmt, NoneT];
    case "while":
      const whileCondTypeExpr = tc_expr(stmt.cond, source, gblEnv, funEnv, classEnv);
      const whileCondType = whileCondTypeExpr[1];
      
      if (neqT(whileCondType, BoolT)) {
	typeError(stmt.cond.pos, `While condition expected a bool, found ${tr(whileCondType)}.`,
		  source);
      }

      // Check the body
      stmt.whileBody = stmt.whileBody.map(s => {
	const res = tc_stmt(s, source, gblEnv, funEnv, classEnv);
	return res[0];
      });
      
      return [stmt, NoneT];
    case "if":
      const condExpr = tc_expr(stmt.cond, source, gblEnv, funEnv, classEnv);
      const condType = condExpr[1];

      if (stmt.branches != []) {
	stmt.branches = stmt.branches.map(branch => {
	  const condExpr = tc_expr(branch.cond, source, gblEnv, funEnv, classEnv);
	  const condType = condExpr[1];
	  if (condType != BoolT) {
	    typeError(stmt.condPos, `If condition expected bool but got ${tr(condType)}`, source);
	  }
	  
	  branch.body = branch.body.map(s => {
	    const res = tc_stmt(s, source, gblEnv, funEnv, classEnv);
	    return res[0];
	  });

	  return branch;
	});
      }

      if (stmt.elseBody != []) {
	stmt.elseBody = stmt.elseBody.map(s => {
	  return tc_stmt(s, source, gblEnv, funEnv, classEnv)[0];
	});
      }

      if (stmt.ifBody != []) {
	stmt.ifBody = stmt.ifBody.map(s => {
	  const res = tc_stmt(s, source, gblEnv, funEnv, classEnv);
	  return res[0];
	});
      }

      if (condType != BoolT) {
	typeError(stmt.condPos, `If condition expected bool but got ${tr(condType)}`, source);
      }

      return [stmt, NoneT];
    case "return":
      const retType = tc_expr(stmt.expr, source, gblEnv, funEnv, classEnv);
      stmt.expr = retType[0];
      
      return [stmt, retType[1]];
    case "func":
      return tc_func(stmt, source, gblEnv, funEnv, classEnv);
    default:
      return [stmt, NoneT];
  }
}

export function
tc_expr(expr : Expr, source: string, gblEnv: GlobalEnv, funEnv: EnvType = <EnvType>{},
	classEnv: Type = undefined): [Expr, Type] {
  switch(expr.tag) {
    case "string":
      expr.iType = StrT;
      return [expr, StrT];
    case "intervalExp":
      expr.iType = StrT; // HACK: Everything is a string for now, it
			 // could be a list in future
      return [expr, expr.iType];
    case "memExp":
      const exprTExpr = tc_expr(expr.expr, source, gblEnv, funEnv, classEnv);
      const exprT = exprTExpr[1];
      expr.expr = assert_itype(exprTExpr[0]);

      
      if (exprT.tag != "class") {
	typeError(expr.expr.pos, `Expression is not of type ${tr(exprT)}, and not of type class`,
		  source);
      } else {
	// TODO: Check if the member exists
	const classRef: ClassEnv = gblEnv.classes.get(exprT.name);
	const memRef = classRef.memberVars.get(expr.member.str);
	
	if (memRef == undefined) {
	  scopeError(expr.member.pos, `${expr.member.str} is not a member of type ${exprT.name}`,
		     source);
	} else {
	  expr.iType = memRef[1];

	  assert_itype(expr);
	  assert_itype(expr.expr);
	  
	  return [expr, memRef[1]];
	}
      }
    case "self":      
      if (classEnv == undefined) {
	scopeError(expr.pos, `Cannot use self keyword without a class`, source);
      } else {
	expr.iType = classEnv;
	return [expr, classEnv];
      }
    case "bool":
      expr.iType = BoolT;
      return [expr, BoolT];

    case "num":
      expr.iType = IntT;
      return [expr, IntT];
      
    case "none":
      expr.iType = NoneT;
      return [expr, NoneT];
      
    case "id":
      if (funEnv[expr.name] != undefined) {
	expr.iType = funEnv[expr.name];
	return [expr, expr.iType];	
      } else if (env[expr.name] != undefined) {
	expr.iType = env[expr.name];
	return [expr, env[expr.name]];
      } else {
	if (classEnv.tag == "class") {
	  const classRef: ClassEnv = gblEnv.classes.get(classEnv.name);
	  expr.iType = classRef.memberVars.get(expr.name)[1]
	  return [expr, expr.iType];
	}
      }
      break;

    case "funcCall":
      const callExpr = expr.name;
      var retType: Type = undefined;
      
      if (callExpr.tag == "memExp" && expr.name.tag == "memExp") {
	const firstPartExpr = tc_expr(callExpr.expr, source, gblEnv, funEnv, classEnv);
	expr.name.expr = assert_itype(firstPartExpr[0]);
	
	const firstPart: Type = firstPartExpr[1];
	const memberFunName = callExpr.member.str;

	if (firstPart.tag == "class") {
	  const classRef: ClassEnv = gblEnv.classes.get(firstPart.name);
	  if (classRef == undefined) {
	    internalError();
	  } else {
	    const memFunRef = classRef.memberFuncs.get(memberFunName);
	    if (memFunRef == undefined) {
	      scopeError(callExpr.member.pos, `Function ${memberFunName}() is not a member of `
		+ `class ${firstPart.name}.`, source);
	    } else {
	      retType = memFunRef.retType;

	      /* Typecheck argument count */
	      const expectedArgCnt = classRef.memberFuncs.get(memFunRef.name).members.length-1;
	      const gotArgCnt = expr.args.length;

	      if (expectedArgCnt != gotArgCnt) {
		argError(expr.prmPos, `Expected ${expectedArgCnt}, got ${gotArgCnt} arguments.`,
			 source);
	      }

	      /* Typecheck argument's type */
	      var prmIter = 0;
	      expr.args = expr.args.map(arg => {
		var retVal = undefined
		// if (prmIter != 0) { /* Skip the first argument which is self for memExp */
		  const gotArgTypeExpr = tc_expr(arg, source, gblEnv, funEnv, classEnv);
		  
		  const expArgType: Type = memFunRef.members[prmIter+1];
		  const gotArgType: Type = gotArgTypeExpr[1];
		  if (neqT(expArgType, gotArgType)) {
		    typeError(arg.pos, `Function ${firstPart.name}.${memberFunName}() expects its `
		      +`argument at pos ${prmIter} to be of type ${tr(expArgType)}, `
		      +`got ${tr(gotArgType)}.`, source);
		  }
		  
		  retVal = gotArgTypeExpr[0];
		// } else {
		//   arg.iType = { tag: "class", name: firstPart.name };
		//   retVal = arg;
		// }
		
		prmIter += 1;
		
		return assert_itype(retVal);
	      });
	    }
	  }
	} else {
	  typeError(callExpr.pos, `Cannot use dot access using function with expression of `
	    +`type ${callExpr.tag}`, source);
	}
      } else if (callExpr.tag == "id" && expr.name.tag == "id") {
	const callName = callExpr.name;
	
	/* Call to global function */
	if (gblEnv.funcs.get(callName) != undefined) {
	  const argsExpected = gblEnv.funcs.get(callName).members.length;
	  const argsProvided = expr.args.length;

	  if (argsExpected != argsProvided) {
	    argError(expr.prmPos, `${expr.name}() needs ${argsExpected} arguments, `
	      +`${argsProvided} provided`, source);
	  }

	  var argIter = 0;
	  expr.args = expr.args.map(arg => {
	    const argTypeProvidedExpr = tc_expr(arg, source, gblEnv, funEnv, classEnv);

	    const argTypeProvided: Type = argTypeProvidedExpr[1];
	    const argTypeExpected: Type = gblEnv.funcs.get(callName).members[argIter];
	    
	    /* Only check if this function is not print() */
	    if (callName != "print") {
	      if (neqT(argTypeProvided, argTypeExpected)) {
		typeError(expr.prmsPosArr[argIter], `Argument ${argIter} is of type `
		  +`${tr(argTypeExpected)}, ${tr(argTypeProvided)} provided`, source);
	      }
	    }
	    
	    argIter += 1;

	    return assert_itype(argTypeProvidedExpr[0]);
	  });
	  retType = gblEnv.funcs.get(callName).retType;
	} else if (gblEnv.classes.get(callName) != undefined) { /* Constructor */
	  const argsProvided = expr.args.length;
	  if (argsProvided != 0) {
	    argError(expr.prmPos, `Constructor for classes take exactly 0 arguments, `
	      +`${argsProvided} provided`, source);
	  }
	  retType = { tag: "class", name: callName }; // Call name is same as the class name
	} else {
	  scopeError(expr.pos, `Function not in scope: ${expr.name}`, source);
	}
	
      }
      expr.iType = retType;
      return [expr, retType];
      
    case "unaryExp":
      tc_uExp(expr.pos, expr.name, tc_expr(expr.arg, source, gblEnv, funEnv, classEnv)[1], source);

      const valExpr = tc_expr(expr.arg, source, gblEnv, funEnv, classEnv);

      expr.arg = valExpr[0];
      expr.iType = valExpr[1];
      
      return [expr, expr.iType];      
    case "binExp":
      const leftExpr = tc_expr(expr.arg[0], source, gblEnv, funEnv, classEnv);
      const leftType = leftExpr[1];
      expr.arg[0] = leftExpr[0];
      
      const rightExpr = tc_expr(expr.arg[1], source, gblEnv, funEnv, classEnv);
      const rightType = rightExpr[1];
      expr.arg[1] = rightExpr[0];
      
      const op = expr.name;

      expr.iType = tc_binExp(expr.pos, op, leftType, rightType, source);
      
      return [expr, expr.iType];
  }
}

export function
typecheck(ast : Array<Stmt>, source: string, env: GlobalEnv) : Type {
  var result: Type = undefined;
  
  var resultAst = ast.map(stmt => {
    var retVal = undefined;
    [retVal, result] = tc_stmt(stmt, source, env);
    
    return retVal;
  });

  return result;
}
