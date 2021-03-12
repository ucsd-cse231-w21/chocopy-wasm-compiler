
import {parser} from "lezer-python";
import {stringInput, TreeCursor} from "lezer-tree";
import { Stats } from "mocha";
import {BinOp, 
        UniOp, 
        Expr, 
        Literal, 
        Stmt, 
        Program,
        FunDef,
        Class,
        Type,
        VarInit,
        typeToString} from "./ast";
import { idenToStr } from "./types";

const INIT_NAME = "__init__";

export function traverseExpr(c : TreeCursor, s : string) : Expr<null> {

  //console.log("CURRENT TYPE: "+c.type.name+" | TARGET: "+s);

  switch(c.type.name) {
    case "String":        return {tag: "literal", value: {tag: "string", value: s.substring(c.from + 1, c.to - 1)}};
    case "Number":        return {tag: "literal", value: {tag: "num", value: BigInt(s.substring(c.from, c.to))}};
    case "Boolean":       return {tag: "literal", value: {tag: "bool", value: s.substring(c.from, c.to) === "True"}};
    case "VariableName":  return {tag: "id", name: s.substring(c.from, c.to)};
    case "self":          return {tag: "id", name: s.substring(c.from, c.to)};
    case "None":          return {tag: "literal", value: {tag: "none"}};
    case "UnaryExpression" : {
      //console.log(" ==> In UnaryExpression");

      c.firstChild();  //traverse the unary operator
      let unaryOp : string = s.substring(c.from, c.to);

      c.nextSibling(); //traverse to the target expression
      let targetExpr : Expr<null> = traverseExpr(c, s);

      c.parent(); //go back to the parent node

      switch(unaryOp){
        case UniOp.Neg: return {tag: "uniop", op: UniOp.Neg, expr: targetExpr};
        case UniOp.Not: return {tag: "uniop", op: UniOp.Not, expr: targetExpr};
      }

      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
    }
    case "BinaryExpression" : {
      //console.log(" ==> In BinaryExpression");
      c.firstChild();  //traverses left expr
      //console.log("    * first child: "+c.type.name);
      let leftExpr : Expr<null> = traverseExpr(c,s);
      //console.log("       ==> first child ACTUAL: "+leftExpr.tag);

      c.nextSibling(); //traveses the operator
      let opStr : string = s.substring(c.from, c.to);
      //console.log("   * next sibling: "+c.type.name+" | ISO: "+opStr);

      c.nextSibling(); //traverses the right expr
      //console.log("   * next next sibling: "+c.type.name);
      let rightExpr : Expr<null> = traverseExpr(c,s);

      c.parent(); //traverse back to parent

      switch (opStr) {
        case BinOp.Plus: return {tag: "binop", op : BinOp.Plus, left: leftExpr, right : rightExpr};
        case BinOp.Minus: return {tag: "binop", op : BinOp.Minus, left: leftExpr, right : rightExpr};
        case BinOp.Mul: return {tag: "binop", op : BinOp.Mul, left: leftExpr, right : rightExpr};
        case BinOp.IDiv: return {tag: "binop", op : BinOp.IDiv, left: leftExpr, right : rightExpr};
        case BinOp.Mod: return {tag: "binop", op : BinOp.Mod, left: leftExpr, right : rightExpr};
        case BinOp.Eq: return {tag: "binop", op : BinOp.Eq, left: leftExpr, right : rightExpr};
        case BinOp.Neq: return {tag: "binop", op : BinOp.Neq, left: leftExpr, right : rightExpr};
        case BinOp.Lte: return {tag: "binop", op : BinOp.Lte, left: leftExpr, right : rightExpr};
        case BinOp.Gte: return {tag: "binop", op : BinOp.Gte, left: leftExpr, right : rightExpr};
        case BinOp.Lt: return {tag: "binop", op : BinOp.Lt, left: leftExpr, right : rightExpr};
        case BinOp.Gt: return {tag: "binop", op : BinOp.Gt, left: leftExpr, right : rightExpr};
        case BinOp.Is: return {tag: "binop", op : BinOp.Is, left: leftExpr, right : rightExpr};
        case BinOp.And: return {tag: "binop", op : BinOp.And, left: leftExpr, right : rightExpr};
        case BinOp.Or: return {tag: "binop", op : BinOp.Or, left: leftExpr, right : rightExpr};
      }

      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
    }
    case "ParenthesizedExpression":{
      c.firstChild(); //goes into ParenthesizedExpression, landing on "("
      c.nextSibling(); //skip "("

      let nestedExpr : Expr<null> = traverseExpr(c, s);

      c.parent();
      return { tag: "nestedexpr", expr : nestedExpr};
    }
    case "MemberExpression":{
      c.firstChild(); //goes into dereferemce, starting at the target of the dereference

      let targetExpr : Expr<null> = traverseExpr(c, s); //parse the target

      c.nextSibling(); //skip over the dot "."
      c.nextSibling(); //goes to the name of the attribute

      let attrName : string = s.substring(c.to, c.from);

      c.parent(); //goes back to parent
      return {tag: "lookup", obj: targetExpr, field: attrName};
    }
    case "CallExpression": {
      //console.log(" ==> In CallExpression");
      c.firstChild();
      //console.log("    * first child: "+c.type.name);

      let callTarget : Expr<null> = traverseExpr(c, s);
      c.nextSibling(); // go to arglist
      //console.log("    * next sib: "+c.type.name);

      c.firstChild(); // go into arglist - the '('  token'
      //console.log("    * next sib fc: "+c.type.name);

      let callArgs : Array<Expr<null>> = new Array;

      let unknownIfArg : string = s.substring(c.from, c.to);
      //console.log("  **unknownifArg: "+unknownIfArg);

      /*
       * Iterate through arglist until the concluding
       * ")" is found - signifying the end of arguments
       */
      while (unknownIfArg !== ")") {
        //console.log(" FUNC CALL: "+unknownIfArg+" | "+callArgs);

        /*
         Becareful not to parse commas and the opening parenthesis!
         */
        if(unknownIfArg !== "," && unknownIfArg !== "(" ){
          callArgs.push(traverseExpr(c,s));
        }

        c.nextSibling();
        unknownIfArg = s.substring(c.from, c.to);
      }

      
      //callArgs.forEach(element => {
      //  console.log("----ARG: "+toString(element));
      //});
      

      c.parent(); // pop arglist
      c.parent(); // pop CallExpression

      if(callTarget.tag === "lookup"){
        return {tag: "method-call", obj: callTarget.obj, method: callTarget.field, arguments: callArgs};
      }
      else if(callTarget.tag === "id"){
        return {tag: "call", name : callTarget.name, arguments: callArgs}; 
      }

      throw new Error("Unknown target of call: "+callTarget.tag+" "+s.substring(c.from, c.to));
    }
    default:
      //DEV NOTE: This is problematic but fixes a lot of problems
      throw new Error("f Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to)+" | "+c.type.name);
  }
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt<null> {

  //console.log("stmt cur state?: "+c.node.type.name);

  switch(c.node.type.name) {
    case "ImportStatement":{
      c.firstChild(); //go into the import statement, landing at the "import" keyword

      let importStatement: Stmt<null> = {tag: "import", isFromStmt: false, target: undefined, compName: undefined, alias: undefined};
      
      if(s.substring(c.from, c.to).trim() === "from"){
        c.nextSibling(); //goes to the target module

        const targetModule = s.substring(c.from, c.to);

        c.nextSibling(); //land on the "import" keyword
        c.nextSibling(); //land on component name to import

        importStatement.compName = new Array();
        const componentName = s.substring(c.from, c.to);
        importStatement.compName.push(componentName);

        const uniquenessComps = new Set();
        uniquenessComps.add(componentName);
        while(c.nextSibling()){
          const compName = s.substring(c.from, c.to).trim();
          if(compName !== "," && !uniquenessComps.has(compName)){
            importStatement.compName.push(compName);
            uniquenessComps.add(compName);
          }
        }

        importStatement.isFromStmt = true;
        importStatement.target = targetModule;
      }
      else{
        c.nextSibling(); //goes to the target module

        const targetModule = s.substring(c.from, c.to);
        importStatement.isFromStmt = false;
        importStatement.target = targetModule;
      }

      if(c.nextSibling()){
        //we're currently in the "as" keyword

        c.nextSibling(); //goes to the alias name

        importStatement.alias = s.substring(c.from, c.to);
      }


      c.parent(); //go back to parent
      return importStatement;
    }
    case "ClassDefinition":{
      c.firstChild();

      c.nextSibling(); //skips over "class" keyword
      const className : string = s.substring(c.from, c.to);
      c.nextSibling(); //moves on from the class name to the arg list
      c.nextSibling(); //skips over the parent arg list. 

      c.firstChild(); //goes into the class body, landing at the colon ":"
      c.nextSibling(); //goes to the first class component 

      let methods : Map<string, FunDef<null>> = new Map;
      let variables : Map<string, VarInit<null>> = new Map;

      //console.log(`----PARSING CLASS ${className} , cur: ${c.node.type.name}`);

      let attrIndex = 0;

      if(s.substring(c.from, c.to).trim().length !== 0){
        do{
          let classComponent : Stmt<null> = traverseStmt(c, s);
  
          //console.log(`   ==> method or var ${classComponent.tag}`);
  
          if(classComponent.tag === "func"){
            if(methods.has(idenToStr(classComponent.def.identity))){
              throw new Error(`The class ${className} already has a function ${idenToStr(classComponent.def.identity)}`);
            }
            else if(classComponent.def.identity.signature.name === INIT_NAME){
              const identity = classComponent.def.identity;

              //__init__ must have no return type, or must return None
              if(identity.returnType.tag !== "none"){
                throw new Error(`__init__ functions can only return None - explicitly or implicitly`);
              }
            }

            //all methods must have a "self" parameter of the host class' name
            //__init__ must have a the self parameter
            const selfType = classComponent.def.parameters.get("self");
            if(selfType === undefined || typeToString(selfType) !== className){
              throw new Error(`The method ${idenToStr(classComponent.def.identity)} has no parameter self of type ${className}`);
            }


            methods.set(idenToStr(classComponent.def.identity), classComponent.def);
          }
          else if(classComponent.tag === "vardec"){
            if(variables.has(classComponent.def.name)){
              throw new Error(`The class ${className} already has an attribute ${classComponent.def.name}`);
            }
  
            //console.log(`----PARSING CLASS ${className} - var: ${classComponent.name}`);
  
            variables.set(classComponent.def.name, classComponent.def);
            attrIndex++;
          }
        } while(c.nextSibling())
      }

      c.parent();

      c.parent();

      return {tag: "class", def: {name: className, fields: variables, methods: methods}};
    }
    case "AssignStatement": {
      //console.log("**** ASSIGN? "+s.substring(c.from, c.to));

      c.firstChild(); //goes into AssignStatement, landing on the variable name
      if(c.node.type.name as string === "MemberExpression"){
        //this is an attribute change

        const leftHand = traverseExpr(c,s);
        c.nextSibling(); //skips over equal sign
        c.nextSibling();
        const rightHand = traverseExpr(c,s);
        c.parent();

        if(leftHand.tag !== "lookup"){
          throw new Error("Unknown attribute assignment expression!");
        }

        return {tag: "field-assign", obj: leftHand.obj, field: leftHand.field, value: rightHand};
      }
      else{
        let varName: string = s.substring(c.from, c.to);

        c.nextSibling(); //maybe a TypeDef or AssignOp
        let localVarType : Type = undefined;
        if(c.node.type.name as string === "TypeDef"){
          //this is a local variable declaration.
          c.firstChild(); //goes into TypeDef and lands on ":"

          c.nextSibling(); //goes to type name
          const lvarTypeName = s.substring(c.from, c.to);
          switch(lvarTypeName){
            case "int" : {localVarType = {tag: "number"}; break;}
            case "bool" : {localVarType = {tag: "bool"}; break;}
            case "str": {localVarType = {tag: "string"}; break;}
            default: {localVarType = {tag: "class", name: lvarTypeName}};
          }

          c.parent();
          c.nextSibling();

          //console.log("      -> is local var dec: "+c.node.type.name);
        }

        c.nextSibling(); //value of the variable 
        let lvarValue : Expr<null> = traverseExpr(c,s);
        c.parent();
        //console.log("******END OF VAR '"+varName+"'");

        if(localVarType === undefined){
          return {tag: "assign", name: varName, value : lvarValue};
        }
        else{
          if(lvarValue.tag !== "literal"){
            throw new Error(`Variable declarations must be initialized with literals, for variable '${varName}'`);
          }

          return {tag: "vardec", def: {name: varName, type: localVarType, value: lvarValue.value}};
          //return {tag: "vardec", name: varName, info: {varType: localVarType, value: lvarValue}};
        }
      }
    }
    case "FunctionDefinition" : {
      c.firstChild();  //enters func def. and lands on "def" keyword

      c.nextSibling();  //goes to the function's name
      let funcName : string = s.substring(c.from, c.to);

      c.nextSibling(); //go into ParamList

      c.firstChild(); //go into ParamList, landing on "("
      c.nextSibling(); //skips over "("
      let params : Map<string, Type> = new Map();
      let tempParamName : string = undefined;
      let expectName : boolean = true;
      //we're gonna parse parameters in a linear fashion.
      //We'll use a boolean flag that tells us whether the next totken is a param's name or type

      while (s.substring(c.from, c.to) !== ")") {
        //keep going through the ParamList until we hit ")"
        if(s.substring(c.from, c.to) !== ","){
          //console.log(" --- PARAM FOR: '"+funcName+"' : "+s.substring(c.from, c.to)+" ? "+expectName);
          if(expectName){
            tempParamName = s.substring(c.from, c.to);

            if(params.has(tempParamName)){
              throw new Error("Already has a parameter '"+tempParamName+"'");
            }

            expectName = false;
          }
          else{
            c.firstChild(); //goes into the TypeDef, landing on ":"
            c.nextSibling(); //goes into the type name
            let tempParamType: string = s.substring(c.from, c.to);
            expectName = true;

            switch(tempParamType){
              case "int" : {params.set(tempParamName, {tag: "number"}); break;}
              case "bool" : {params.set(tempParamName, {tag: "bool"}); break;}
              case "str": {params.set(tempParamName, {tag: "string"}); break;}
              default: {params.set(tempParamName, {tag: "class", name: tempParamType});};
            }

            c.parent();
          }
        }
        c.nextSibling();
      }
      c.parent();  //go back to parent, from ParamList

      c.nextSibling(); //next node should either be a TypeDef or Body
      let returnType : Type = {tag: "none"};
      if(c.node.type.name as string === "TypeDef"){
        c.firstChild(); //lands on arrow
        c.nextSibling(); //goes to actual type

        let rawReturnType: string = s.substring(c.from, c.to);
        switch(rawReturnType){
          case "int" : {returnType = {tag: "number"}; break;}
          case "bool" : {returnType = {tag: "bool"}; break;}
          case "str" : {returnType = {tag: "string"}; break;}
          default: {returnType = {tag: "class", name: rawReturnType}}
        }
        c.parent();
        c.nextSibling(); //goes to function body
      }

      //console.log("----FUNC POST PARAM: "+c.node.type.name);

      c.firstChild(); //enters function body, lands on colon
      //console.log("----FUNC POST PARAM After: "+c.node.type.name);

      let funcLocalVars : Map<string, VarInit<null>> = new Map();
      let funcStates : Array<Stmt<null>> = new Array();

      //local vars must be declared before any other statement

      while (c.nextSibling()) {
        //console.log("---FUNC STATEMENT: "+c.node.type.name);
        
        const bodyStmt = traverseStmt(c, s);
        //console.log("*************result: "+toStringStmt(bodyStmt));
        
        if(bodyStmt.tag === "vardec"){
          if(funcLocalVars.has(bodyStmt.def.name) || params.has(bodyStmt.def.name)){
            throw new Error(`Local variable ${bodyStmt.def.name} has already been declared!`);
          }

          funcLocalVars.set(bodyStmt.def.name, bodyStmt.def);
        }
        else{
          funcStates.push(bodyStmt);
        }
      }
      c.parent();

      c.parent();

      return {tag: "func", 
              def: {identity: {signature: {name: funcName, parameters: Array.from(params.values())}, 
                               returnType: returnType}, 
                    parameters: params,
                    localVars: funcLocalVars, 
                    body: funcStates}};
    }
    case "IfStatement": {
      c.firstChild(); //goes to "if" keyword

      c.nextSibling(); //goes to condition
      const condition = traverseExpr(c,s);

      c.nextSibling(); //goes to true branch's body
      c.firstChild();  //goes into true branch's body, starting at the semicolon
      const trueBranch: Array<Stmt<null>> = new Array();
      while(c.nextSibling()){
        const trueBStmt = traverseStmt(c,s);
        trueBranch.push(trueBStmt);
      }
      c.parent(); //goes back to if-statement node

      c.nextSibling(); //goes to else statement
      //console.log("----BACK TO ELSE: "+c.node.type.name);
      c.nextSibling(); //goes to false branch's body
      c.firstChild();  //goes into true branch's body, starting at the semicolon
      const falseBranch: Array<Stmt<null>> = new Array();
      while(c.nextSibling()){
        const falseBStmt = traverseStmt(c,s);
        falseBranch.push(falseBStmt);
      }
      c.parent();


      c.parent();
      return {tag: "if", 
              cond: condition,
              thn: trueBranch,
              els: falseBranch};
    }
    case "WhileStatement":{
      c.firstChild(); //goes to "while" keyword

      c.nextSibling(); //goes to condition statement
      const cond = traverseExpr(c,s);

      c.nextSibling(); //goes to true branch's body
      c.firstChild();  //goes into true branch's body, starting at the semicolon
      const body: Array<Stmt<null>> = new Array();
      while(c.nextSibling()){
        const bodyStmt = traverseStmt(c,s);
        body.push(bodyStmt);
      }
      c.parent(); //goes back to if-statement node

      c.parent();
      return {tag: "while", cond: cond, body: body};
    }
    case "ReturnStatement": {
      c.firstChild();  //enter node and land on the return keyword
      c.nextSibling(); //jump to the target expression

      let targetExpr : Expr<null> = undefined;
      if(s.substring(c.from, c.to).trim().length > 0){
        targetExpr = traverseExpr(c, s);
      }
      c.parent();

      return {tag: "return", value: targetExpr === undefined ? {tag: "literal", value: {tag: "none"}} : targetExpr};
    }
    case "PassStatement": {
      return {tag: "pass"};
    }
    case "ExpressionStatement": {
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return { tag: "expr", expr: expr };
    }
    default:
      throw new Error("TYPE: "+c.node.type.name+" Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverse(c : TreeCursor, s : string) : Program<null> {
  switch(c.node.type.name) {
    case "Script":
      c.firstChild();

      const funcs = new Map<string, FunDef<null>>();
      const classes = new Map<string, Class<null>>();
      const vars = new Map<string, VarInit<null>>();
      const stmts = new Array<Stmt<null>>();
      const imports = new Array<Stmt<null>>();

      do {
        const stmt = traverseStmt(c, s);
        switch(stmt.tag){
          case "func": {
            const funcSig = idenToStr(stmt.def.identity);
            if(funcs.has(funcSig)){
              throw new Error(`Duplicate function ${funcSig}`);
            }

            funcs.set(funcSig, stmt.def);
            break;
          }
          case "class" : {
            if(classes.has(stmt.def.name)){
              throw new Error(`Duplicate class called ${stmt.def.name}`);
            }

            classes.set(stmt.def.name, stmt.def);
            break;
          }
          case "vardec": {
            if(vars.has(stmt.def.name)){
              throw new Error(`Duplicate variable ${stmt.def.name}`);
            }

            vars.set(stmt.def.name, stmt.def);
            break;
          }
          case "import": {
            imports.push(stmt);
          }
          default: {
            stmts.push(stmt);
            break;
          }
        }
      } while(c.nextSibling())

      return {funcs: funcs, inits: vars, classes: classes, stmts: stmts, imports: imports};
    default:
      throw new Error("Could not parse program at " + c.node.from + " " + c.node.to);
  }
}
export function parse(source : string) : Program<null> {
  const t = parser.parse(source);
  const prog = traverse(t.cursor(), source);
  return prog;
}
