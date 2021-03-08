import { Stmt, Expr, UniOp, BinOp, Type, Program, Literal, FunDef, VarInit, Class, typeToString } from "./ast";
import { NUM, BOOL, NONE, unhandledTag, unreachable } from "./utils";
import * as BaseException from "./error";
import { idenToStr, ModulePresenter, OrganizedModule } from "./types";
import { BuiltInModule } from "./builtins/builtins";
import { type } from "cypress/types/jquery";
import { builtinModules } from "module";
import { MemoryAllocator } from "./heap";
import { all } from "cypress/types/bluebird";

export type LabeledModule = {
  moduleCode: number,
  classes : Map<string, {typeCode: number, 
                         varIndices: Map<string, {index: number, 
                                                  initValue?: Literal}>}>,
  funcs: Map<string, string>, //maps function signatures to function labels
  globalVars: Map<string, number> // maps global variables to their indices
}

export type CompileResult = {
  instrs: Array<string>,
  modules: Array<LabeledModule> //first module is the source module
}

/*
export type CallSite = 
{tag: "external", level: string, label: string} | 
{tag: "local", label: string}
*/

export type IdenType = 
{tag: "localvar"} |
{tag: "globalvar", index: number} |
{tag: "module", code: number} 

//-------------SYSTEM FUNCTION CALLS-------------

/**
 * Instantiates a class. 
 * Argument is a typecode
 */
const INTANCTIATE = "1nstanciate"; //argument is typecode

/**
 * Returns the value of an object attribute
 * 1st arg: address of object
 * 2nd arg: index of attribute
 */
const OBJ_DEREF = "2objref";

/**
 * Mutates the value of an object attribute
 * 1st arg: address of object
 * 2nd arg: index of attribute
 * 3rd arg: value to change attribute to
 */
const OBJ_MUTATE = "3objmute";

/**
 * Allocates a primitive (int or bool instance)
 * 1st arg: primitive type (1 for bool, 2 for int)
 * 2nd arg: value of primitive
 */
const ALLOC_PRIM = "4prim"; //first argument (1 for bool, 2 for int), second argument is the value

/**
 * Returns the numerical representation of a primitive.
 * 1st arg: primitive type (1 for bool, 2 for int)
 * 2nd arg: address of primitive
 */
const GET_PRIM = "5gprim"; //first argument (1 for bool, 2 for int), second argument is the object address

/**
 * Returns the value of a module's variable
 * 1st arg: module code
 * 2nd arg: variable index
 */
const BUILT_REF = "6mod_ref";  //first argument - module code, second argument var index

/**
 * Mutates the value of a module's variable
 * 1st arg: module code
 * 2nd arg: variable index
 * 3rd arg: value to change the variable to
 */
const BUILT_STORE = "7mod_mutate";  //first argument - module code, second argument var index, third argument is new value

/**
 * Checks if two objects are equal.
 * 1st arg: address of the first object
 * 2nd arg: address of the second object
 * 
 * NOTE: Assuming the source program has passed type checking,
 *       if the two objects are both booleans or integers, then
 *       they're matched by their integer/boolean values
 */
const EQ_PRIM = "8qual"; //argument is the object address

/**
 * Checks if two objects are not equal.
 * 1st arg: address of the first object
 * 2nd arg: address of the second object
 * 
 * NOTE: Assuming the source program has passed type checking,
 *       if the two objects are both booleans or integers, then
 *       they're matched by their integer/boolean values
 */
const NEQ_PRIM = "9nqual"; //argument is the object address

//-------------SYSTEM FUNCTION CALLS END-------------

const TEMP_VAR = "1emp"; //used for returning values at the end of functions


function lookup(name: string, maps: Array<Map<string, IdenType>>) : IdenType {
  for(let m of maps){
    const found = m.get(name);
    if(found !== undefined){
      return found;
    }
  }
  return undefined;
}


function includeImports(imprts: Array<Stmt<Type>>, 
                        builtins: Map<string, LabeledModule>) : Map<string, IdenType>{
  const imprtMap = new Map<string, IdenType>();
  for(let imprt of imprts){
    if(imprt.tag === "import" && !imprt.isFromStmt){
      const moduleCode = builtins.get(imprt.target).moduleCode;
      imprtMap.set(imprt.alias, {tag: "module", code: moduleCode});
    }
  }
  return imprtMap;
}

export function compile(progam: OrganizedModule, 
                        labeledSource: LabeledModule, 
                        builtins: Map<string, LabeledModule>,
                        allcator: MemoryAllocator) : Array<string> {
  const allInstrs = new Array<string>();

  //set the first global vars to be imports
  const globalVars = includeImports(progam.imports, builtins);

  allInstrs.push(`(func $exported_func (export "exported_func") (result i32)`);
  //now, add on global variables
  for(let [vName, info] of progam.fileVars.entries()){
    const index = labeledSource.globalVars.get(vName);

    globalVars.set(vName, {tag: "globalvar", index: index});

    switch(info.value.tag){
      case "num": {
        allInstrs.push(`(call $${BUILT_STORE} 
                          (i32.const ${labeledSource.moduleCode}) 
                          (i32.const ${index}) 
                          (call $${ALLOC_PRIM} (i32.const 2) ${info.value.value})
                        )`);
        break;
      }
      case "bool": {
        allInstrs.push(`(call $${BUILT_STORE} 
                          (i32.const ${labeledSource.moduleCode}) 
                          (i32.const ${index}) 
                          (call $${ALLOC_PRIM} (i32.const 1) ${info.value.value})
                        )`);
        break;
      }
      case "string": {
        const strAddress = allcator.staticStrAllocate(info.value.value);
        allInstrs.push(`(call $${BUILT_STORE} 
                          (i32.const ${labeledSource.moduleCode}) 
                          (i32.const ${index}) 
                          (i32.const ${strAddress})
                        )`);
        break;
      }
      case "none": {
        allInstrs.push(`(call $${BUILT_STORE} 
                          (i32.const ${labeledSource.moduleCode}) 
                          (i32.const ${index}) 
                          (i32.const 0)
                        )`);
        break;
      }
    }
  }

  //now compile top level stmts
  for(let tlStmt of progam.topLevelStmts){
    allInstrs.push(codeGenStmt(tlStmt, [globalVars], labeledSource, builtins, allcator).join("\n"));
  }
  allInstrs.push(`)`);

  return allInstrs;
}


function codeGenStmt(stmt: Stmt<Type>, 
                     idens: Array<Map<string, IdenType>>, 
                     sourceModule: LabeledModule,
                     builtins: Map<string, LabeledModule>,
                     allcator: MemoryAllocator): Array<string> {
  switch (stmt.tag) {
    case "import": {
      //shouldn't be triggered as we put imports in a seperate list
      return [];
    }
    case "assign":{
      const result = lookup(stmt.name, idens);
      if(result === undefined){
        //this should be a fatal error. 
        //Type checking should have caught this
        throw new Error(`Unfound identifier ${stmt.name}`);
      }
      else {
        const valueInstr = codeGenExpr(stmt.value, idens, sourceModule, builtins, allcator);

        if(result.tag === "localvar"){
          return [`(local.set $${stmt.tag} ${valueInstr})`];
        }
        else if(result.tag === "globalvar"){
          return [`(call $${BUILT_STORE} (i32.const 0) (i32.const ${result.index}) ${valueInstr})`];
        }
        else{
          //this shouldn't happen as type checking wouldn't allow it
          throw new Error(`Fatal error at re-assigning an import statement ${JSON.stringify(stmt)}`);
        }
      }
    }
    case "return":{
      return [`(local.set $${TEMP_VAR} ${codeGenExpr(stmt.value, idens, sourceModule, builtins, allcator)})`];
    }
    case "expr": {
      return [codeGenExpr(stmt.expr, idens, sourceModule, builtins, allcator), "(drop)"];
    }
    case "if": {
      const condInstrs = codeGenExpr(stmt.cond, idens, sourceModule, builtins, allcator);
      const thenBranch = stmt.thn.map(x => codeGenStmt(x, idens, sourceModule, builtins, allcator));
      const elseBranch = stmt.els.map(x => codeGenStmt(x, idens, sourceModule, builtins, allcator));

      return [`(if ${condInstrs} (then ${thenBranch.join("\n")}) (else ${elseBranch.join("\n")}) )`];
    }
    case "pass": {
      return [];
    }
    case "field-assign": {
      //check if target object is an imported module
      if(stmt.a.tag === "class"){
        const valueInstrs = codeGenExpr(stmt.value, idens, sourceModule, builtins, allcator);
        if(stmt.a.name.startsWith("module$")){
          //module reference
          const moduleName = stmt.a.name.split("$")[1];
          const targetModule = builtins.get(moduleName);
          const varIndex = targetModule.globalVars.get(stmt.field);

          return [`(call $${BUILT_STORE} (i32.const ${targetModule.moduleCode}) (i32.const ${varIndex}) ${valueInstrs} )`];
        }
        else{
          const objInstrs = codeGenExpr(stmt.obj, idens, sourceModule, builtins, allcator);
          const targetClass = sourceModule.classes.get(stmt.a.name);
          const varIndex = targetClass.varIndices.get(stmt.field);

          return [`(call $${OBJ_MUTATE} ${objInstrs} (i32.const ${varIndex}) ${valueInstrs})`];
        }
      }

      throw new Error(`Instances of ${typeToString(stmt.a)} have no attributes ${stmt.field}`);
    }
    case "while": {
      const condInstrs = codeGenExpr(stmt.cond, idens, sourceModule, builtins, allcator);
      const loopBody = stmt.body.map(x => codeGenStmt(x, idens, sourceModule, builtins, allcator));

      return [`(block (loop ${loopBody.join("\n")} (br_if 0 ${condInstrs}) (br 1) ))`];
    }
    default: throw new Error(`Unsupported statement type ${stmt.tag}`);
  }
}

function codeGenExpr(expr: Expr<Type>, 
                     idens: Array<Map<string, IdenType>>, 
                     sourceModule: LabeledModule,
                     builtins: Map<string, LabeledModule>,
                     allcator: MemoryAllocator): string {
  switch(expr.tag){
    case "id": {
      const idensResults = lookup(expr.name, idens);
      switch(idensResults.tag){
        case "localvar": return `(local.get $${expr.name})`;
        case "globalvar": return `(call $${BUILT_REF} (i32.const 0) (i32.const ${idensResults.index}))`;
        case "module" : return `(i32.const ${builtins.get(idensResults.originalName).moduleCode})`;
      }
    }
    case "lookup":{
      const objInstrs = codeGenExpr(expr.obj, idens, sourceModule, builtins, allcator);
      if(expr.obj.a.tag === "class"){
        if(expr.obj.a.name.startsWith("module$")){
          //this is a module
          const moduleName = expr.obj.a.name.split("$")[1];
          const varIndex = builtins.get(moduleName).globalVars.get(expr.field);
          return `(call $${BUILT_REF} ${objInstrs} (i32.const ${varIndex}))`;
        }
        else{
          const targetClass = sourceModule.classes.get(expr.obj.a.name);
          const varIndex = targetClass.varIndices.get(expr.field);
          return `(call ${OBJ_DEREF} ${objInstrs} (i32.const ${varIndex.index}))`;
        }
      }

      throw new Error("objects of type "+typeToString(expr.obj.a)+" have no attributes");
    }
    case "literal": {
      switch(expr.value.tag){
        case "num": return `(call ${ALLOC_PRIM} (i32.const 1) (i32.const ${expr.value.value}))`;
        case "bool": return `(call ${ALLOC_PRIM} (i32.const 2) (i32.const ${expr.value.value ? 1 : 0}))`;
        case "string": {
          const strAddr = allcator.staticStrAllocate(expr.value.value)
          return `(i32.const ${strAddr})`;
        };
        case "none": return `(i32.const 0)`;
      }
    }
    case "binop": {
      const leftObject = codeGenExpr(expr.left, idens, sourceModule, builtins, allcator);
      const rightObject = codeGenExpr(expr.right, idens, sourceModule, builtins, allcator);

      switch(expr.op){
        case BinOp.Plus:  return `(i32.add (call $${GET_PRIM} (i32.const 2) ${leftObject}) (call $${GET_PRIM} (i32.const 2) ${rightObject}))`;
        case BinOp.Minus: return `(i32.sub (call $${GET_PRIM} (i32.const 2) ${leftObject}) (call $${GET_PRIM} (i32.const 2) ${rightObject}))`;
        case BinOp.Mul:   return `(i32.mul (call $${GET_PRIM} (i32.const 2) ${leftObject}) (call $${GET_PRIM} (i32.const 2) ${rightObject}))`;
        case BinOp.IDiv:  return `(i32.div_s (call $${GET_PRIM} (i32.const 2) ${leftObject}) (call $${GET_PRIM} (i32.const 2) ${rightObject}))`;
        case BinOp.Mod:   return `(i32.rem_s (call $${GET_PRIM} (i32.const 2) ${leftObject}) (call $${GET_PRIM} (i32.const 2) ${rightObject}))`;
        case BinOp.Eq:    return `(call $${EQ_PRIM} ${leftObject} ${GET_PRIM} )`;
        case BinOp.Neq:   return `(call $${NEQ_PRIM} ${leftObject} ${GET_PRIM} )`;
        case BinOp.Lte:   return `(i32.le_s (call $${GET_PRIM} (i32.const 2) ${leftObject}) (call $${GET_PRIM} (i32.const 2) ${rightObject}))`;
        case BinOp.Gte:   return `(i32.ge_s (call $${GET_PRIM} (i32.const 2) ${leftObject}) (call $${GET_PRIM} (i32.const 2) ${rightObject}))`;
        case BinOp.Lt:    return `(i32.lt_s (call $${GET_PRIM} (i32.const 2) ${leftObject}) (call $${GET_PRIM} (i32.const 2) ${rightObject}))`;
        case BinOp.Gt:    return `(i32.gt_s (call $${GET_PRIM} (i32.const 2) ${leftObject}) (call $${GET_PRIM} (i32.const 2) ${rightObject}))`;
        case BinOp.Is:    return `(i32.eq ${leftObject} ${rightObject})`;
        case BinOp.And:   return `(call ${ALLOC_PRIM} (i32.const 2) (i32.and (call $${GET_PRIM} (i32.const 1) ${leftObject}) (call $${GET_PRIM} (i32.const 1) ${rightObject})))`;
        case BinOp.Or:    return `(call ${ALLOC_PRIM} (i32.const 2) (i32.or (call $${GET_PRIM} (i32.const 1) ${leftObject}) (call $${GET_PRIM} (i32.const 1) ${rightObject})))`;
      }
    }
    case "list-expr" : {
      throw new Error("list compilation not supported yet!");
    }
    case "method-call": {
      const targetLabel = sourceModule.funcs.get(idenToStr(expr.callSite.iden));      
      const argInstrs = expr.arguments.map(x => codeGenExpr(x, idens, sourceModule, builtins, allcator));
      return `(call $${targetLabel} ${argInstrs.join(" ")})`;
    }
    case "call": {
      if(sourceModule.classes.has(expr.name)){
        //this is object instantiation
        const typeInfo = sourceModule.classes.get(expr.name);
        return `(call ${INTANCTIATE} (i32.const ${typeInfo.typeCode}))`;
      }

      const targetLabel = sourceModule.funcs.get(idenToStr(expr.callSite.iden));      
      const argInstrs = expr.arguments.map(x => codeGenExpr(x, idens, sourceModule, builtins, allcator));
      return `(call $${targetLabel} ${argInstrs.join(" ")})`;
    }
    default: throw new Error("unsuppored expr compilation "+expr.tag);
  }
}

