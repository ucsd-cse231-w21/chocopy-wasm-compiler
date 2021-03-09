import { Stmt, Expr, Type, UniOp, BinOp, Literal, Program, FunDef, VarInit, Class, typeToString, Parameter } from "./ast";
import { NUM, BOOL, NONE, CLASS, unhandledTag, unreachable } from "./utils";
import * as BaseException from "./error";
import { callToSignature, ClassPresenter, fdefToIdentity, fdefToSigStr, FuncIdentity, idenToStr, literalToType, ModulePresenter, OrganizedClass, OrganizedFunc, OrganizedModule } from "./types";

// I ❤️ TypeScript: https://github.com/microsoft/TypeScript/issues/13965
export class TypeCheckError extends Error {
  __proto__: Error;
  constructor(message?: string) {
    const trueProto = new.target.prototype;
    super(message);

    // Alternatively use Object.setPrototypeOf if you have an ES6 environment.
    this.__proto__ = trueProto;
  }
}

export type GlobalTable = {
  vars: Map<string, {type: Type, module: string}>,
  funcs: Map<string, {iden: FuncIdentity, module: string}>,
  classes: Map<string, {classPresen: ClassPresenter, module: string}>
}

function flookup(fname: string, 
                 fpTypes: Array<Type>,
                 funcMap: Map<string, {iden: FuncIdentity, module: string}>) : 
                 {iden: FuncIdentity, module: string} {
  const sig = callToSignature(fname, fpTypes);
  if(funcMap.has(sig)){
    return funcMap.get(sig);
  }
  else{
    //account for None and object types
    const ofSameName = Array.from(
      funcMap.entries()).filter(
          x => x[1].iden.signature.name == fname && 
              x[1].iden.signature.parameters.length == fpTypes.length);

    for(let [ x , iden] of ofSameName){
      console.log("candidate: "+x);
      let incompatabilityFound = false;
    
      for(let i = 0; i < iden.iden.signature.parameters.length; i++){
        const declaredType = iden.iden.signature.parameters[i];
        const receivedType = fpTypes[i];
    
        if( (declaredType.tag === "class" && 
            ( ( (receivedType.tag === "none") || 
                (receivedType.tag === "class" && receivedType.name === declaredType.name) ) || 
                (declaredType.name === "object") ) ) || 
    
            (declaredType.tag === receivedType.tag)){
              continue;
        }
        else{
          incompatabilityFound = true;
          break;
        }
      }
    
      if(!incompatabilityFound){
        return iden;
      }
    }
    
    return undefined;
  }
}

/**
 * Looks up a vairable's type from a list of variable maps.
 * If the varibale cannot be found, undefined is returned
 */
function lookup(targetVar: string, varMaps: Array<Map<string, Type>>) : Type {
  for (let vmap of varMaps) {
    if(vmap.has(targetVar)){
      return vmap.get(targetVar);
    }
  }
  return undefined;
} 

/**
 * Checks if a type is assignable to another type
 * @param destType - the destination type
 * @param sourceType - the source type
 */
function isAssignable(destType: Type, sourceType: Type) : boolean {
  if(destType.tag === "none"){
      return sourceType.tag === "none";
  }

  if(destType.tag === "class"){
      return (destType.name === "object") || 
             (sourceType.tag === "none") || 
             (sourceType.tag === "class" && sourceType.name === destType.name)
  }
  else{
      console.log(`  in assignable ${destType === undefined} ${sourceType === undefined}`);
      return destType.tag === sourceType.tag;
  }
}

function checkReturn(body: Array<Stmt<Type>>, expectedReturnType: Type) : boolean {
  if(body.length >= 1){
      const lastStatemnt = body[body.length - 1];
      if(lastStatemnt.tag === "return"){
          return isAssignable(expectedReturnType, lastStatemnt.value.a);
      }
      else if(lastStatemnt.tag === "if"){
          return checkReturn(lastStatemnt.thn, expectedReturnType) && 
                 checkReturn(lastStatemnt.els, expectedReturnType);
      }
      else if(lastStatemnt.tag === "while"){
        return checkReturn(lastStatemnt.body, expectedReturnType);
      }
  }
  return false;
}

/**
 * Creates a ClassPresenter out of a class declaration
 * @param classDef - the ClassPresenter than represents a class
 */
function makePresenter(classDef: Class<null>) : ClassPresenter{
  const result: ClassPresenter = {
    name: classDef.name,
    instanceVars: new Map(),
    instanceMethods: new Map()
  };

  //add instance variables
  for(let v of classDef.fields){
    if(result.instanceVars.has(v.name)){
      throw new TypeCheckError(`For the class ${result.name}, the field ${v.name} already exists`);
    }

    result.instanceVars.set(v.name, {type: v.type, initValue: v.value});
  }

  //add instance methods
  for(let m of classDef.methods){
    const fSig = fdefToSigStr(m);
    if(result.instanceMethods.has(fSig)){
      throw new TypeCheckError(`For the class ${result.name}, the method ${fSig} already exists`);
    }

    result.instanceMethods.set(fSig, fdefToIdentity(m));
  }

  return result;
}

function doesTypeExist(type: Type, table: GlobalTable) : string {
  if(type.tag === "class"){
    return table.classes.has(type.name) ? undefined : type.name;
  }
  else if(type.tag === "list"){
    return doesTypeExist(type.content_type, table);
  }
  else if(type.tag === "callable"){
    for(let par of type.args){
      const potentialError = doesTypeExist(par, table);
      if(potentialError !== undefined){
        return potentialError;
      }
    }

    return doesTypeExist(type.ret, table);
  }
  return undefined;
}

/**
 * Adds imported types and functions to the provided GlobalTable
 * @param env - the GlobalTable to add imported components
 * @param builtIns - the builtin modules available
 * @param imports - the statement list containing import statements
 */
export function includeImports(env: GlobalTable, 
                               builtIns: Map<string, ModulePresenter>, 
                               imports: Array<Stmt<null>>){
  //include imports. We include imports first rather than including
  //global variable to allow for overriding
  for(let imprt of imports){
    if(imprt.tag === "import"){
      if(imprt.isFromStmt){
        const compSet = new Set(imprt.compName);
        //include all components in target in this module
        const target = builtIns.get(imprt.target);
        if(target === undefined){
          throw new TypeCheckError(`Unfound module ${imprt.target}`);
        }

        let anyFound = false;

        //add functions to env with the name mentioned 
        for(let [name, def] of target.functions.entries()){
          console.log(`---- Including import from module ${target.name} ${name}`);
          if(compSet.has(def.signature.name)){
            anyFound = true;

            env.funcs.set(idenToStr(def), {iden: def, module: imprt.target});
          }
        }

        //add classes to env with the name mentioned 
        for(let [name, def] of target.classes.entries()){
          if(compSet.has(name)){
            anyFound = true;

            env.classes.set(name, {classPresen: def, module: imprt.target});
          }
        }

        //add module variables to env with the name mentioned 
        //Should I remove this feature? This is bad coding practice. Best to not allow it.
        for(let [name, type] of target.moduleVars.entries()){
          if(compSet.has(name)){
            anyFound = true;

            env.vars.set(name, {type: type, module: imprt.target});
          }
        }
        

        if(!anyFound){
          throw new TypeCheckError(`Cannot find any component named as ${Array.from(compSet).join(",")} in the module ${target.name}`);
        }
      }
      else{
        if(!builtIns.has(imprt.target)){
          throw new TypeCheckError(`No module named ${imprt.target}`);
        }
        env.vars.set(imprt.alias === undefined ? 
                       imprt.target : 
                       imprt.alias,
                     {type: {tag: "class", name: "module$"+imprt.target}, module: undefined});
      }
    }
  }
}



function tcExpr(expr: Expr<null>, 
                vars: Array<Map<string, Type>>, 
                global: GlobalTable,
                builtIns: Map<string, ModulePresenter>) : Expr<Type>{
  switch(expr.tag){
    case "literal": return {a: literalToType(expr.value), tag: "literal", value: expr.value};
    case "binop" :  {
      const left = tcExpr(expr.left, vars, global, builtIns);
      const right = tcExpr(expr.right, vars, global, builtIns);

      const leftType = left.a;
      const rightType = right.a;

      const equalityOps = new Set([BinOp.Eq, BinOp.Neq]);
      const relational = new Set([BinOp.Lte, BinOp.Lt, BinOp.Gte, BinOp.Gt]);
      const arithOps = new Set([BinOp.Plus, BinOp.Minus, BinOp.Mul, BinOp.IDiv, BinOp.Mul]);

      if(expr.op === BinOp.Is){
          if(leftType.tag === "bool" || leftType.tag === "number" || 
             rightType.tag === "bool" || rightType.tag === "number"){
              throw new TypeCheckError("'is' operator can only be used on class instances!");
          }

          return {a: {tag: "bool"}, tag: "binop", op: expr.op, left: left, right: right};
      }
      else if(equalityOps.has(expr.op)){
         if( (leftType.tag === "class" && (rightType.tag === "class" || rightType.tag === "none")) || 
             (rightType.tag === "class" && (leftType.tag === "class" || leftType.tag === "none"))  || 
             (leftType.tag === "none" && (rightType.tag === "class" || rightType.tag === "none")) || 
             (rightType.tag === "none" && (leftType.tag === "class" || leftType.tag === "none"))  ||
             (typeToString(leftType) === typeToString(rightType)) ){
              return {a: {tag: "bool"}, tag: "binop", op: expr.op, left: left, right: right};
         }
         
          throw new TypeCheckError("Both operands must be of the same time when using '"+expr.op+"'");     
      }
      else if((relational.has(expr.op) || arithOps.has(expr.op))){
          if(leftType.tag !== "number" || rightType.tag !== "number"){
              throw new TypeCheckError("Both operands must be ints when using '"+expr.op+"'");
          }
          
          if(relational.has(expr.op)){
              return {a: {tag: "bool"}, tag: "binop", op: expr.op, left: left, right: right};
          }

          return {a: {tag: "number"}, tag: "binop", op: expr.op, left: left, right: right};
      }

      //this shouldn't throw, but it makes TypeScript happy
      throw new TypeCheckError("Unknown operand? '"+expr.op+"'!");
    }
    case "uniop": {
      const target = tcExpr(expr.expr, vars, global, builtIns);
      const targetType = target.a;
      switch(expr.op){
        case UniOp.Neg: {
          if(targetType.tag !== "number"){
            throw new TypeCheckError(`'${typeToString(targetType)}' can only be applied on ints.`);
          }

          return {a:targetType, tag: "uniop", op: expr.op, expr: target};
        }
        case UniOp.Not: {
          if(targetType.tag !== "bool"){
            throw new TypeCheckError(`'${typeToString(targetType)}' can only be applied on bools.`);
          }

          return {a:targetType, tag: "uniop", op: expr.op, expr: target};
        }
      }
    }
    case "builtin1":{
      return tcExpr({tag: "call", 
                     name: expr.name, 
                     arguments: [expr.arg]}, vars, global, builtIns);
    }
    case "builtin2":{
      return tcExpr({tag: "call", 
                     name: expr.name, 
                     arguments: [expr.left, expr.right]}, vars, global, builtIns);
    }
    case "call":{
      const typedArgExprs : Array<Expr<Type>> = new Array();

      console.log(` ====> tcing call ${expr.name} ${expr.arguments.length}`);
      for(let i = 0; i < expr.arguments.length; i++){
        const typedExpr = tcExpr(expr.arguments[i], vars, global, builtIns);
        typedArgExprs.push(typedExpr);
      }

      const argTypes : Array<Type> = typedArgExprs.map(x => x.a);
      const target = flookup(expr.name, argTypes, global.funcs);

      if(target !== undefined){
        return {a: target.iden.returnType, 
                tag: "call", 
                name: expr.name, 
                arguments: typedArgExprs, 
                callSite: {iden: target.iden, module: target.module, isConstructor: false}};
      }
      else if(global.classes.has(expr.name)){
        const targetClass = global.classes.get(expr.name);
        return {a: {tag: "class", name: expr.name}, 
                tag: "call", 
                name: expr.name, 
                arguments: typedArgExprs, 
                callSite: {iden: {signature: {name: expr.name, 
                                              parameters: argTypes}, 
                                  returnType: {tag: "class", 
                                               name: expr.name}}, 
                           module: targetClass.module,
                           isConstructor: true}};
      }

      throw new TypeCheckError(`Unfound function: ${callToSignature(expr.name, argTypes)}`);
    }
    case "id": {
      const idType = lookup(expr.name, vars);
      if(idType === undefined){
        throw new TypeCheckError(`Cannot find variable named ${expr.name}`);
      }

      return {a: idType, tag: "id", name: expr.name};
    }
    case "lookup": {
      const target = tcExpr(expr.obj, vars, global, builtIns);
      const targetType = target.a;

      if(targetType.tag === "class"){
        if(targetType.name.startsWith("module$")){
          //this is a module
          const moduleName = targetType.name.split("$")[1];
          const module = builtIns.get(moduleName);

          if(module === undefined){
            throw new TypeCheckError(`Cannot find the module ${moduleName}`);
          }

          const moduleVar = module.moduleVars.get(expr.field);
          if(moduleVar === undefined){
            throw new TypeCheckError(`Cannot find field ${expr.field} in the module ${moduleName}`);
          }

          return {a: moduleVar, tag: "lookup", obj: target, field: expr.field};
        }
        else{
          const targetClass = global.classes.get(targetType.name);
          if(targetClass === undefined){
            throw new TypeError(`Cannot find the type ${targetType.name}`);
          }
          else{
            const fieldType = targetClass.classPresen.instanceVars.get(expr.field);
            if(fieldType === undefined){
              throw new TypeError(`The type ${targetType.name} has no instance variable ${expr.field}`);
            }

            return {a: fieldType.type, tag: "lookup", obj: target, field: expr.field};
          }
        }
      }
      else{
        throw new TypeError(`The type ${typeToString(targetType)} has no attributes`);
      }
    }
    case "list-expr": {
      const valueTypes = expr.contents.map(x => tcExpr(x, vars, global, builtIns));
      return {a: {tag: "list", 
                  content_type: {tag: "class", 
                                 name: "object"}}, 
              tag: "list-expr", 
              contents: valueTypes};
    }
    case "method-call":{

      console.log(` ====> meth call ${JSON.stringify(expr)}`);

      const target = tcExpr(expr.obj, vars, global, builtIns);
      const targetArgs = expr.arguments.map(x => tcExpr(x, vars, global, builtIns));
      const argTypes = [target.a].concat(targetArgs.map(x => x.a));
      const callSig = callToSignature(expr.method, argTypes);
      const targetType = target.a;

      if(targetType.tag === "class"){
        if(targetType.name.startsWith("module$")){
          //this is a module
          const moduleName = targetType.name.split("$")[1];
          const module = builtIns.get(moduleName);

          if(module === undefined){
            throw new TypeCheckError(`Cannot find the module ${moduleName}`);
          }

          const moduleFuncs = new Map<string, {iden: FuncIdentity, module: string}>();
          for(let [name, info] of module.functions.entries()){
            moduleFuncs.set(name, {iden: {signature: info.signature, returnType: info.returnType}, module: moduleName});
          }
          const moduleFunc = flookup(expr.method, argTypes, moduleFuncs);
          if(moduleFunc === undefined){
            throw new TypeCheckError(`Cannot find method ${callSig} in the module ${moduleName}`);
          }

          return {a: moduleFunc.iden.returnType, 
                  tag: "call", 
                  name: expr.method,
                  arguments: targetArgs,
                  callSite: {iden: moduleFunc.iden, module: moduleName, isConstructor: false}
                };
        }
        else{
          const targetClass = global.classes.get(targetType.name);
          if(targetClass === undefined){
            throw new TypeError(`Cannot find the type ${targetType.name}`);
          }
          else{
            const instanceMeths = new Map<string, {iden: FuncIdentity, module: string}>();
            for(let [name, info] of targetClass.classPresen.instanceMethods.entries()){
              instanceMeths.set(name, {iden: {signature: info.signature, returnType: info.returnType}, module: undefined});
            }

            const instanceMeth = flookup(expr.method, argTypes, instanceMeths);
            if(instanceMeth === undefined){
              throw new TypeError(`The type ${targetType.name} has no method ${callSig}`);
            }

            return {a: instanceMeth.iden.returnType, 
                    tag: "method-call", 
                    obj: target, 
                    method: expr.method,
                    arguments: targetArgs,
                    callSite: {iden: instanceMeth.iden, module: instanceMeth.module, isConstructor: false}
                  };
          }
        }
      }
      else{
        throw new TypeError(`The type ${typeToString(targetType)} has no methods`);
      }
    }
    default: throw new Error(`EXPR ${expr.tag} is unsupported!`);
  }
}

function tcStmt(stmt: Stmt<null>, 
                vars: Array<Map<string, Type>>, 
                global: GlobalTable,
                builtIns: Map<string, ModulePresenter>) : Stmt<Type>{
  switch(stmt.tag){
    case "import": {
      //ignore. This has already been accounted for
      break;
    }
    case "assign": {
      const varType = lookup(stmt.name, vars);
      if(varType === undefined){
        throw new Error(`Cannot find variable ${stmt.name} ${JSON.stringify(vars)}`);
      }

      const typedValue = tcExpr(stmt.value, vars, global, builtIns);
      if(typedValue.tag === "list-expr"){
        for(let cont of typedValue.contents){
          if(!isAssignable(varType, cont.a)){
            throw new TypeCheckError(`The type ${typeToString(cont.a)} is not assignable to ${typeToString(varType)}`);
          }
        }

        return {a: varType, tag: "assign", name: stmt.name, value: typedValue};
      }
      else if(!isAssignable(varType, typedValue.a)){
        throw new TypeCheckError(`The type ${typeToString(typedValue.a)} is not assignable to ${typeToString(varType)}`);
      }

      return {a: {tag: "none"}, tag: "assign", name: stmt.name, value: typedValue};
    }
    case "return":{
      const returnType = tcExpr(stmt.value, vars, global, builtIns);
      return {a: returnType.a, tag: "return", value: returnType};
    }
    case "expr":{
      const returnType = tcExpr(stmt.expr, vars, global, builtIns);
      return {a: returnType.a, tag: "expr", expr: returnType};
    }
    case "if":{
      const typedCond = tcExpr(stmt.cond, vars, global, builtIns);
      if(typedCond.a.tag !== "bool"){
        throw new TypeCheckError(`if-statement conditions must be bools`);
      }

      const newThen = stmt.thn.map(x => tcStmt(x, vars, global, builtIns));
      const elseThen = stmt.els.map(x => tcStmt(x, vars, global, builtIns));

      return {a: {tag: "none"}, tag: "if", cond: typedCond, thn: newThen, els: elseThen};
    }
    case "pass":{
      return {a: {tag: "none"}, tag: "pass"};
    }
    case "while": {
      const condTyped = tcExpr(stmt.cond, vars, global, builtIns);

      if(condTyped.a.tag !== "bool"){
        throw new TypeCheckError(`While loop condition must evaluate to a boolean.`);
      }

      const typedBody = stmt.body.map(x => tcStmt(x, vars, global, builtIns));
      return {a: {tag: "none"}, tag: "while", cond: condTyped, body: typedBody};
    }
    case "field-assign":{
      const leftSideType = tcExpr(stmt.obj, vars, global, builtIns);

      const leftFieldType = tcExpr({tag: "lookup", obj: stmt.obj, field: stmt.field}, vars, global, builtIns);
      const valueType = tcExpr(stmt.value, vars, global, builtIns);
      if(!isAssignable(leftFieldType.a, valueType.a)){
        throw new TypeCheckError(`The type ${typeToString(valueType.a)} is not assignable to ${typeToString(leftSideType.a)}`);
      }

      console.log(` ---------tcing field assign: ${typeToString(leftSideType.a)}`);
      return {a: valueType.a, 
              tag: "field-assign", 
              obj: leftSideType,  //DEV_NOTE: This may potentially cause errors. Be careful
              field: stmt.field, 
              value: valueType};
    }
    default: throw new Error(`STMT ${stmt.tag} is unsupported!`);
  }
}

function tcClassDef(def: Class<null>, 
                    global: GlobalTable, 
                    builtIns: Map<string, ModulePresenter>) : OrganizedClass{
  //structures for OrganizedClass
  const newFields : Map<string, VarInit<Type>> = new Map();
  const newMethods : Map<string, OrganizedFunc> = new Map();

  //for presenter
  const presenter : ClassPresenter = global.classes.get(def.name).classPresen;

  for(let v of def.fields){
    if(!isAssignable(v.type, literalToType(v.value))){
      throw new TypeCheckError(`The type ${typeToString(literalToType(v.value))} is not assignable to ${typeToString(v.type)}`);
    }
    else if(newFields.has(v.name)){
      throw new TypeCheckError(`Duplicate class variable ${v.name} for class ${def.name}`);
    }

    //presenter.instanceVars.set(v.name, {type: v.type, initValue: v.value});
    newFields.set(v.name, {a: literalToType(v.value), 
                           name: v.name, 
                           type: v.type, 
                           value: v.value});
  }


  for(let f of def.methods){
    const newF = tcFuncDef(f, global, builtIns);
    const sig = idenToStr(newF.identity);
    if(newMethods.has(sig)){
      throw new TypeCheckError(`Duplicate method ${sig} for class ${def.name}`);
    }

    //presenter.instanceMethods.set(sig, newF.identity);
    newMethods.set(sig, newF);
  }
                    
  return {name: def.name, fields: newFields, methods: newMethods, presenter: presenter};
}

function tcFuncDef(def: FunDef<null>, 
                   global: GlobalTable, 
                   builtIns: Map<string, ModulePresenter>) : OrganizedFunc{
  //function signature. Useful for errors
  const funcIdentity = fdefToIdentity(def);
  console.log(`-------TCing Func def: ${idenToStr(funcIdentity)}`);

  //check if return type exists
  const retMissing = doesTypeExist(def.ret, global);
  if(retMissing !== undefined){
    throw new TypeCheckError(`The type ${retMissing} cannot be found!`);
  }

  //Local scope for this function defintion
  const localScope: Map<string, Type> = new Map();

  //structures are for the OrganizedFunc to be returned
  const newParams: Map<string, Type> = new Map();
  const newLocals: Map<string, VarInit<Type>> = new Map();
  const newStmts: Array<Stmt<Type>> = new Array();

  //add parameters to local scope
  for(let param of def.parameters){
    if(localScope.has(param.name)){
      throw new TypeCheckError(`Duplicate variable declaration ${param.name}`);
    }

    //check for type existence
    const missingType = doesTypeExist(param.type, global);
    if(missingType !== undefined){
      throw new TypeCheckError(`The type ${missingType} cannot be found!`);
    }

    localScope.set(param.name, param.type);
    newParams.set(param.name, param.type);
  }

  //add local variables to scope
  for(let v of def.inits){
    const missingType = doesTypeExist(v.type, global);
    if(missingType !== undefined){
      throw new TypeCheckError(`The type ${missingType} cannot be found!`);
    }

    const literalType = literalToType(v.value);
    if(!isAssignable(v.type, literalType)){
      throw new TypeCheckError(`${literalToType(v.value)} isn't assignable to ${typeToString(v.type)} for variable ${v.name}`);
    }

    localScope.set(v.name, literalType);
    newLocals.set(v.name, {a: literalToType(v.value), name: v.name, type: v.type, value: v.value});
  }

  //a return statement may have been encountered already.
  //if so, there's no need to check other paths
  let returnType: Type = {tag: "none"};  //if function returns None, no need to check return

  //check function body
  for(let i = 0; i < def.body.length; i++){
    const newStmt: Stmt<Type> = tcStmt(def.body[i], [localScope], global, builtIns);
    returnType = newStmt.a;

    newStmts.push(newStmt);
  }

  console.log(`======> is func return type undef? ${funcIdentity.returnType === undefined}`);
  if(!checkReturn(newStmts, funcIdentity.returnType)){
    if(funcIdentity.returnType.tag !== "none"){
      throw new TypeCheckError(`The function ${idenToStr(funcIdentity)} must have 
                                a return type of ${typeToString(funcIdentity.returnType)}`);
    }
    else{
      newStmts.push({tag: "return", value: {tag: "literal", value: {tag: "none"}}});
    }
  }

  return {identity: funcIdentity, params: newParams, vars: newLocals, stmts: newStmts};
}

export function tc(existingEnv: ModulePresenter, 
                   builtIns: Map<string, ModulePresenter>, 
                   program: Program<null>): OrganizedModule {

  const curGlobalTable: GlobalTable = {
    vars: existingEnv === undefined ? new Map() : new Map(existingEnv.moduleVars),
    funcs: existingEnv === undefined ? new Map() : new Map(existingEnv.functions),
    classes: existingEnv === undefined ? new Map() : new Map(existingEnv.classes)
  }

  //first include imports
  includeImports(curGlobalTable, builtIns, program.stmts);

  //start adding module components
  //start with classes
  for(let c of program.classes){
    if(curGlobalTable.classes.has(c.name)){
      throw new TypeCheckError(`The class ${c.name} already exists!`);
    }
    curGlobalTable.classes.set(c.name, {classPresen: makePresenter(c), module: undefined});
  }

  //continue with functions
  for(let f of program.funs){
    const fSig = fdefToSigStr(f);
    if(curGlobalTable.funcs.has(fSig)){
      throw new TypeCheckError(`The function ${fSig} already exists!`);
    }
    curGlobalTable.funcs.set(fSig, {iden: fdefToIdentity(f), module: undefined});
  }

  //====================Now we do type checking!

  //These structures are for the OrganizedModule we'll be returning
  const modVars: Map<string, VarInit<Type>> = new Map();
  const modFunctions: Map<string, OrganizedFunc> = new Map();
  const modClasses: Map<string, OrganizedClass> = new Map();
  const tlStmts: Array<Stmt<Type>> = new Array();

  const modPresenter: ModulePresenter = {
    name: undefined,
    moduleVars: new Map(),
    functions: new Map(),
    classes: new Map()
  };

  Array.from(curGlobalTable.funcs.entries()).forEach(x => 
                                     modPresenter.functions.set(x[0], x[1].iden));
  Array.from(curGlobalTable.classes.entries()).forEach(x => 
                                     modPresenter.classes.set(x[0], x[1].classPresen));


  //Check global variables
  for(let v of program.inits){
    if(curGlobalTable.vars.has(v.name)){
      throw new TypeCheckError(`The variable ${v.name} already exists!`);
    }
    else{
      const unfoundType = doesTypeExist(v.type, curGlobalTable);
      if(unfoundType !== undefined){
        throw new TypeCheckError(`The type ${unfoundType} cannot be found!`);
      }
      else if(!isAssignable(v.type, literalToType(v.value))){
        throw new TypeCheckError(`For the variable ${v.name}: cannot assign ${literalToType(v.value)} to ${typeToString(v.type)}`);
      }
    }
    
    curGlobalTable.vars.set(v.name, {type: v.type, module: undefined});
    modVars.set(v.name, {a: literalToType(v.value), 
                         name: v.name, 
                         type: v.type, 
                         value: v.value});
    modPresenter.moduleVars.set(v.name, v.type);
  }

  //check functions
  for(let func of program.funs){
    const signature = fdefToSigStr(func);
    const newFunc = tcFuncDef(func, curGlobalTable, builtIns);
    modFunctions.set(signature, newFunc);
  }

  //check class
  for(let classDef of program.classes){
    const newClassDef = tcClassDef(classDef, curGlobalTable, builtIns);
    modClasses.set(classDef.name, newClassDef);
  }
  
  const imports = new Array<Stmt<null>>();
  //check top-level statements
  for(let stmt of program.stmts){
    if(stmt.tag === "import"){
      imports.push(stmt);
    }
    else{
      const newStmt = tcStmt(stmt, [modPresenter.moduleVars], curGlobalTable, builtIns);
      tlStmts.push(newStmt);
    }
  }

  return {imports: imports,
          fileVars: modVars, 
          fileFunctions: modFunctions, 
          fileClasses: modClasses, 
          topLevelStmts: tlStmts, 
          presented: modPresenter};
}