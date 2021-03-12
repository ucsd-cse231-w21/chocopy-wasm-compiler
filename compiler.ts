import { Stmt, Expr, UniOp, BinOp, Type, Program, Literal, FunDef, VarInit, Class, typeToString } from "./ast";
import { NUM, BOOL, NONE, unhandledTag, unreachable } from "./utils";
import * as BaseException from "./error";
import { FuncIdentity, idenToStr, ModulePresenter } from "./types";
import { BuiltInModule } from "./builtins/builtins";
import { type } from "cypress/types/jquery";
import { builtinModules } from "module";
import { MainAllocator } from "./heap";
import { all } from "cypress/types/bluebird";
import { last } from "cypress/types/lodash";

const INIT_NAME = "__init__";

export type LabeledModule = {
  moduleCode: number,
  classes : Map<string, LabeledClass>,
  funcs: Map<string, {identity: FuncIdentity, label: string}>, //maps function signatures to function labels
  globalVars: Map<string, number> // maps global variables to their indices
}

export type LabeledClass = {
  typeCode: number,
  varIndices: Map<string, number>,
  methods: Map<string, {identity: FuncIdentity, label: string}>
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
{tag: "globalvar", moduleCode: number, index: number} |
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
 * Returns the value of a module's variable
 * 1st arg: module code
 * 2nd arg: variable index
 */
const MOD_REF = "4mod_ref";  //first argument - module code, second argument var index

/**
 * Mutates the value of a module's variable
 * 1st arg: module code
 * 2nd arg: variable index
 * 3rd arg: value to change the variable to
 */
const MOD_STORE = "5mod_mutate";  //first argument - module code, second argument var index, third argument is new value

/**
 * Checks if two objects are equal.
 * 1st arg: address of the first object
 * 2nd arg: address of the second object
 * 
 * NOTE: Assuming the source program has passed type checking,
 *       if the two objects are both booleans or integers, then
 *       they're matched by their integer/boolean values
 */
const EQ_PRIM = "6qual"; //argument is the object address

/**
 * Checks if two objects are not equal.
 * 1st arg: address of the first object
 * 2nd arg: address of the second object
 * 
 * NOTE: Assuming the source program has passed type checking,
 *       if the two objects are both booleans or integers, then
 *       they're matched by their integer/boolean values
 */
const NEQ_PRIM = "7nqual"; //argument is the object address

/**
 * Returns the integer that's wrapped by an integer object
 * 1st arg: address of the integer object
 */
const GET_INT = "8int";

/**
 * Returns the boolean that's wrapped by a boolean object
 * 1st arg: address of the boolean object
 */
const GET_BOOL = "9bool";

/**
 * Allcoates an integer object
 * 1st arg: the interger to be allocated
 */
const ALLC_INT = "8aint";

/**
 * Allcoates a boolean object
 * 1st arg: the boolean to be allocated
 */
const ALLC_BOOL = "9abool";

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

function createSystemFuncHeaders(): Array<string>{
  const headers = new Array<string>();
  headers.push(
    `(func $${INTANCTIATE} (import "system" "instanciate") (param i32) (result i32))`,
    `(func $${OBJ_DEREF} (import "system" "objderef") (param i32) (param i32) (result i32))`,
    `(func $${OBJ_MUTATE} (import "system" "objmute") (param i32) (param i32) (param i32))`,
    `(func $${MOD_REF} (import "system" "modRef") (param i32) (param i32) (result i32))`,
    `(func $${MOD_STORE} (import "system" "modMute") (param i32) (param i32) (param i32) )`,

    `(func $${GET_INT} (import "system" "getInt") (param i32) (result i32))`,
    `(func $${GET_BOOL} (import "system" "getBool") (param i32) (result i32))`,
    `(func $${ALLC_INT} (import "system" "allocInt") (param i32) (result i32))`,
    `(func $${ALLC_BOOL} (import "system" "allocBool") (param i32) (result i32))`,
    );
  return headers;
}

function includeImports(imprts: Array<Stmt<Type>>, 
                        builtins: Map<string, LabeledModule>) : {vars: Map<string, IdenType>, instr: Array<string>}{
  const imprtMap = new Map<string, IdenType>();
  const funcHeaders = new Array<string>();

  const includedFuncs = new Map<string, Set<string>>(); //we don't want to repeat the same imported functions

  for(let imprt of imprts){
    if(imprt.tag === "import"){
      //console.log(` ***PRELUDING IMPORT ${imprt.target}`);

      const targetModule = builtins.get(imprt.target);

      let importedFuncs: Set<string> = undefined;
      if(includedFuncs.has(imprt.target)){
        importedFuncs = includedFuncs.get(imprt.target);
      }
      else{
        importedFuncs = new Set<string>();
        includedFuncs.set(imprt.target, importedFuncs);
      }

      let compNames = new Set<String>();
      if(imprt.isFromStmt){
        imprt.compName.forEach(x => compNames.add(x));
      }
      else{
        const moduleCode = builtins.get(imprt.target).moduleCode;
        imprtMap.set(imprt.alias === undefined ? imprt.target : imprt.alias, {tag: "module", code: moduleCode});
      }


      //add function labels
      for(let [_, info] of targetModule.funcs.entries()){
        if(!imprt.isFromStmt || compNames.has(info.identity.signature.name)){
          const funcIden = idenToStr(info.identity);
          if(!importedFuncs.has(funcIden)){
            const params = "(param i32)".repeat(info.identity.signature.parameters.length);
            const header = `(func $${info.label} (import "${imprt.target}" "${info.label}") ${params} (result i32))`;
            funcHeaders.push(header);

            importedFuncs.add(funcIden);
          }
        }
      }

      //add class methods labels
      for(let [name, info] of targetModule.classes.entries()){
        if(!imprt.isFromStmt || compNames.has(name)){
          for(let [_, fInfo] of info.methods.entries()){
            const methIden = name+"$"+idenToStr(fInfo.identity);
            if(!importedFuncs.has(methIden)){
              const params = "(param i32)".repeat(fInfo.identity.signature.parameters.length);
              const header = `(func $${fInfo.label} (import "${imprt.target}" "${fInfo.label}") ${params} (result i32))`;
              funcHeaders.push(header);

              importedFuncs.add(methIden);
            }
          }
        }
      }

      //add module variables
      for(let [name, index] of targetModule.globalVars.entries()){
        if(!imprt.isFromStmt || compNames.has(name)){
          imprtMap.set(name, {tag: "globalvar", moduleCode: targetModule.moduleCode, index: index});
        }
      }
      
    }
  }
  return {vars: imprtMap, instr: funcHeaders};
}

function convertLastPath(stmts: Array<Stmt<Type>>) {
  if(stmts.length >= 1){
    const lastStmt = stmts[stmts.length - 1];
    if(lastStmt.tag === "expr"){
      stmts[stmts.length - 1] = {a: lastStmt.a, tag: "return", value: lastStmt.expr};
    }
    else if(lastStmt.tag === "if"){
      convertLastPath(lastStmt.thn);
      convertLastPath(lastStmt.els);
    }
  }
}

export function compile(progam: Program<Type>, 
                        labeledSource: LabeledModule, 
                        builtins: Map<string, LabeledModule>,
                        allcator: MainAllocator) : Array<string> {
  const allInstrs = new Array<string>();

  //add system function headers
  const system = createSystemFuncHeaders();
  allInstrs.push(...system);

  //set the first global vars to be imports
  const imports = includeImports(progam.imports, builtins);
  Array.from(labeledSource.globalVars.entries()).forEach(
    x => imports.vars.set(x[0], {tag: "globalvar", moduleCode: 0, index: x[1]})
  );

  //console.log(` ----------PRE COMPILE: ${imports.instr.join("\n")}`);
  allInstrs.push(...imports.instr);

  allInstrs.push(`(func $exported_func (export "exported_func") (result i32)`);
  allInstrs.push(`(local $${TEMP_VAR} i32)`); //used for statement values
  allInstrs.push(`(local.set $${TEMP_VAR} (i32.const 0))`); //initialize it with 0
  //now, add on global variables
  for(let [vName, info] of progam.inits.entries()){
    const index = labeledSource.globalVars.get(vName);

    imports.vars.set(vName, {tag: "globalvar", moduleCode: 0, index: index});

    switch(info.value.tag){
      case "num": {
        allInstrs.push(`(call $${MOD_STORE} 
                          (i32.const ${labeledSource.moduleCode}) 
                          (i32.const ${index}) 
                          (call $${ALLC_INT} (i32.const ${info.value.value}))
                        )`);
        break;
      }
      case "bool": {
        allInstrs.push(`(call $${MOD_STORE} 
                          (i32.const ${labeledSource.moduleCode}) 
                          (i32.const ${index}) 
                          (call $${ALLC_BOOL} (i32.const ${info.value.value ? 1 : 0}))
                        )`);
        break;
      }
      case "string": {
        const strAddress = allcator.allocStr(info.value.value);
        allInstrs.push(`(call $${MOD_STORE} 
                          (i32.const ${labeledSource.moduleCode}) 
                          (i32.const ${index}) 
                          (i32.const ${strAddress})
                        )`);
        break;
      }
      case "none": {
        allInstrs.push(`(call $${MOD_STORE} 
                          (i32.const ${labeledSource.moduleCode}) 
                          (i32.const ${index}) 
                          (i32.const 0)
                        )`);
        break;
      }
    }
  }

  //convert that last viable path - not counting loops - to a return statement
  convertLastPath(progam.stmts);

  //now compile top level stmts
  for(let tlStmt of progam.stmts){
    //console.log(` =====> COMP TPLVEL : ${tlStmt.tag}`);
    allInstrs.push(codeGenStmt(tlStmt, [imports.vars], labeledSource, builtins, allcator).join("\n"));
  }

  allInstrs.push(`(local.get $${TEMP_VAR})`);
  allInstrs.push(`)`);

  //compile classes
  Array.from(progam.classes.values()).forEach(
    x => {
      const LabeledClass = labeledSource.classes.get(x.name);

      Array.from(x.methods.values()).forEach(
        m => {
          const funcIden = idenToStr(m.identity);
          const label = LabeledClass.methods.get(funcIden).label;
          const methInstrs = m.identity.signature.name === INIT_NAME ?
                              codeGenConstr(m, [imports.vars], label, labeledSource, builtins, allcator) : 
                              codeGenFunction(m, [imports.vars], label, labeledSource, builtins, allcator);

          allInstrs.push(...methInstrs);
        }
      );
    }
  );

  //compile top level functions
  Array.from(progam.funcs.values()).forEach(
    x => {
      const funcIden = idenToStr(x.identity);
      const label = labeledSource.funcs.get(funcIden).label;
      const funcInstrs = codeGenFunction(x, [imports.vars], label, labeledSource, builtins, allcator);

      allInstrs.push(...funcInstrs);
    }
  );


  return allInstrs;
}

function codeGenConstr(func: FunDef<Type>, 
                       idens: Array<Map<string, IdenType>>, 
                       label: string, 
                       sourceModule: LabeledModule,
                       builtins: Map<string, LabeledModule>,
                       allcator: MainAllocator): Array<string> {
  const instrs = new Array<string>();

  const localVars = new Map<string, IdenType>();

  //translate parameters to WASM
  let params = "";
  Array.from(func.parameters.entries()).forEach(
    x => {
          params += `(param $${x[0]} i32) `; 
          localVars.set(x[0], {tag: "localvar"});
         }
  );

  const header = `(func $${label} ${params} (result i32)`;
  instrs.push(header);
  instrs.push(`(local $${TEMP_VAR} i32)`); //used for statement values

  //add local variables
  Array.from(func.localVars.entries()).forEach(
    x => {
          instrs.push(`(local $${x[0]} i32)`);
          localVars.set(x[0], {tag: "localvar"});
         }
  );

  //set initial values for local variables
  Array.from(func.localVars.entries()).forEach(
    x => instrs.push(`(local.set $${x[0]} ${codeGenLiteral(x[1].value, allcator)})`)
  );

  //set initial value for TEMP_VAR
  //instrs.push(`(local.set $${TEMP_VAR} (i32.const 0))`);

  const newIdens = [localVars].concat(idens);
  func.body.forEach(x => instrs.push(...codeGenStmt(x, newIdens, sourceModule, builtins, allcator)));

  instrs.push(`(local.get $self)`);
  instrs.push(")");
  return instrs;
}

function codeGenFunction(func: FunDef<Type>, 
                         idens: Array<Map<string, IdenType>>, 
                         label: string, 
                         sourceModule: LabeledModule,
                         builtins: Map<string, LabeledModule>,
                         allcator: MainAllocator): Array<string> {
  const instrs = new Array<string>();

  const localVars = new Map<string, IdenType>();
  
  //translate parameters to WASM
  let params = "";
  Array.from(func.parameters.entries()).forEach(
    x => {
          params += `(param $${x[0]} i32) `; 
          localVars.set(x[0], {tag: "localvar"});
        }
  );

  const header = `(func $${label} ${params} (result i32)`;
  instrs.push(header);
  instrs.push(`(local $${TEMP_VAR} i32)`); //used for statement values

  //add local variables
  Array.from(func.localVars.entries()).forEach(
    x => {
           instrs.push(`(local $${x[0]} i32)`);
           localVars.set(x[0], {tag: "localvar"});
         }
  );

  //set initial values for local variables
  Array.from(func.localVars.entries()).forEach(
    x => instrs.push(`(local.set $${x[0]} ${codeGenLiteral(x[1].value, allcator)})`)
  );

  //set initial value for TEMP_VAR
  //instrs.push(`(local.set $${TEMP_VAR} (i32.const 0))`);

  const newIdens = [localVars].concat(idens);
  func.body.forEach(x => instrs.push(...codeGenStmt(x, newIdens, sourceModule, builtins, allcator)));

  instrs.push(`(local.get $${TEMP_VAR})`);
  instrs.push(")");
  return instrs;
}

function codeGenStmt(stmt: Stmt<Type>, 
                     idens: Array<Map<string, IdenType>>, 
                     sourceModule: LabeledModule,
                     builtins: Map<string, LabeledModule>,
                     allcator: MainAllocator): Array<string> {
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
          return [`(local.set $${stmt.name} ${valueInstr})`];
        }
        else if(result.tag === "globalvar"){
          return [`(call $${MOD_STORE} (i32.const 0) (i32.const ${result.index}) ${valueInstr})`];
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
      const thenBranch = stmt.thn.map(x => codeGenStmt(x, idens, sourceModule, builtins, allcator).join("\n"));
      const elseBranch = stmt.els.map(x => codeGenStmt(x, idens, sourceModule, builtins, allcator).join("\n"));

      return [`(if (call $${GET_BOOL} ${condInstrs}) (then ${thenBranch.join("\n")}) (else ${elseBranch.join("\n")}) )`];
    }
    case "pass": {
      return [];
    }
    case "field-assign": {
      //check if target object is an imported module
      //console.log(`compiling...... ${JSON.stringify(stmt.obj)}`);
      const objInstrs = codeGenExpr(stmt.obj, idens, sourceModule, builtins, allcator);
      if(stmt.obj.a.tag === "class"){
        const valueInstrs = codeGenExpr(stmt.value, idens, sourceModule, builtins, allcator);
        if(stmt.obj.a.name.startsWith("module$")){
          //module reference
          const moduleName = stmt.obj.a.name.split("$")[1];
          const targetModule = builtins.get(moduleName);
          const varIndex = targetModule.globalVars.get(stmt.field);

          return [`(call $${MOD_STORE} ${objInstrs} ${valueInstrs} (i32.const ${varIndex}))`];
        }
        else{
          const targetClass = sourceModule.classes.get(stmt.obj.a.name);
          const varIndex = targetClass.varIndices.get(stmt.field);

          return [`(call $${OBJ_MUTATE} ${objInstrs} (i32.const ${varIndex}) ${valueInstrs})`];
        }
      }

      throw new Error(`Instances of ${typeToString(stmt.obj.a)} have no attributes ${stmt.field}`);
    }
    case "while": {
      const condInstrs = codeGenExpr(stmt.cond, idens, sourceModule, builtins, allcator);
      const loopBody = stmt.body.map(x => codeGenStmt(x, idens, sourceModule, builtins, allcator).join("\n"));

      return [`(block (loop ${loopBody.join("\n")} (br_if 0 ${condInstrs}) (br 1) ))`];
    }
    default: throw new Error(`Unsupported statement type ${stmt.tag}`);
  }
}

function codeGenLiteral(literal: Literal, allcator: MainAllocator) : string{
  switch(literal.tag){
    case "num": return `(call $${ALLC_INT} (i32.const ${literal.value}))`;
    case "bool": return `(call $${ALLC_BOOL} (i32.const ${literal.value ? 1 : 0}))`;
    case "string": {
      const strAddr = allcator.allocStr(literal.value);
      return `(i32.const ${strAddr})`;
    };
    case "none": return `(i32.const 0)`;
  }
}

function codeGenExpr(expr: Expr<Type>, 
                     idens: Array<Map<string, IdenType>>, 
                     sourceModule: LabeledModule,
                     builtins: Map<string, LabeledModule>,
                     allcator: MainAllocator): string {
  switch(expr.tag){
    case "id": {
      const idensResults = lookup(expr.name, idens);
      //console.log(`   ---- maps: ${JSON.stringify(idens)}`);
      switch(idensResults.tag){
        case "localvar": return `(local.get $${expr.name})`;
        case "globalvar": return `(call $${MOD_REF} (i32.const ${idensResults.moduleCode}) (i32.const ${idensResults.index}))`;
        case "module" : return `(i32.const ${idensResults.code})`;
      }
    }
    case "lookup":{
      const objInstrs = codeGenExpr(expr.obj, idens, sourceModule, builtins, allcator);
      if(expr.obj.a.tag === "class"){
        if(expr.obj.a.name.startsWith("module$")){
          //this is a module
          const moduleName = expr.obj.a.name.split("$")[1];
          const varIndex = builtins.get(moduleName).globalVars.get(expr.field);
          return `(call $${MOD_REF} ${objInstrs} (i32.const ${varIndex}))`;
        }
        else{
          const targetClass = sourceModule.classes.get(expr.obj.a.name);
          const varIndex = targetClass.varIndices.get(expr.field);
          return `(call $${OBJ_DEREF} ${objInstrs} (i32.const ${varIndex}))`;
        }
      }

      throw new Error("objects of type "+typeToString(expr.obj.a)+" have no attributes");
    }
    case "literal": {
      return codeGenLiteral(expr.value, allcator);
    }
    case "nestedexpr": {
      return codeGenExpr(expr.expr, idens, sourceModule, builtins, allcator);
    }
    case "uniop":{
      const targetInstr = codeGenExpr(expr.expr, idens, sourceModule, builtins, allcator);

      switch(expr.op){
        case UniOp.Not: {
          return `(call $${ALLC_BOOL} (select (i32.const 0) (i32.const 1) (call $${GET_BOOL} ${targetInstr}) ))`;
        }
        case UniOp.Neg:{
          return `(call $${ALLC_INT} (i32.mul (i32.const -1) (call $${GET_INT} ${targetInstr}) ))`;
        }
      }
    }
    case "binop": {
      return codeGenBinOp(expr.left, expr.right, expr.op, idens, sourceModule, builtins, allcator);
    }
    case "list-expr" : {
      throw new Error("list compilation not supported yet!");
    }
    case "method-call": {
      const targetClass = sourceModule.classes.get(typeToString(expr.obj.a));
      const targetLabel = targetClass.methods.get(idenToStr(expr.callSite.iden));   
      
      const targetInstr = codeGenExpr(expr.obj, idens, sourceModule, builtins, allcator);
      const argInstrs = expr.arguments.map(x => codeGenExpr(x, idens, sourceModule, builtins, allcator));
      return `(call $${targetLabel.label} ${targetInstr} ${argInstrs.join(" ")})`;
    }
    case "call": {
      const argInstrs = expr.arguments.map(x => codeGenExpr(x, idens, sourceModule, builtins, allcator));

      if(expr.callSite.isConstructor){
        //this is object instantiation
        const typeInfo = sourceModule.classes.get(expr.name);
        const initLabel = typeInfo.methods.get(idenToStr(expr.callSite.iden));

        return `(call $${initLabel.label} (call $${INTANCTIATE} (i32.const ${typeInfo.typeCode})) ${argInstrs.join(" ")})`
      }

      if(expr.callSite.module === undefined){
        //function is in the source module
        const targetLabel = sourceModule.funcs.get(idenToStr(expr.callSite.iden));      
        return `(call $${targetLabel.label} ${argInstrs.join(" ")})`;
      }
      else{
        const targetModule = builtins.get(expr.callSite.module);
        const targetLabel = targetModule.funcs.get(idenToStr(expr.callSite.iden));      
        return `(call $${targetLabel.label} ${argInstrs.join(" ")})`;
      }
    }
    default: throw new Error("unsuppored expr compilation "+expr.tag);
  }
}

function codeGenBinOp(left: Expr<Type>,
                      right: Expr<Type>,
                      op: BinOp, 
                      idens: Array<Map<string, IdenType>>, 
                      sourceModule: LabeledModule,
                      builtins: Map<string, LabeledModule>,
                      allcator: MainAllocator): string {
  const leftObject = codeGenExpr(left, idens, sourceModule, builtins, allcator);
  const rightObject = codeGenExpr(right, idens, sourceModule, builtins, allcator);

  const boolResultOps = new Set([BinOp.Eq, BinOp.Neq, BinOp.Lte, BinOp.Lt, BinOp.Gte,  BinOp.Gt, BinOp.Is, BinOp.And, BinOp.Or]);
  let instr = "";
  switch(op){
    case BinOp.Plus: { 
      instr = `(i32.add (call $${GET_INT} ${leftObject}) (call $${GET_INT} ${rightObject}))`;
      break;
    }
    case BinOp.Minus: { 
      instr =  `(i32.sub (call $${GET_INT} ${leftObject}) (call $${GET_INT} ${rightObject}))`;
      break;
    }
    case BinOp.Mul: {
      instr =  `(i32.mul (call $${GET_INT} ${leftObject}) (call $${GET_INT} ${rightObject}))`;
      break;
    }
    case BinOp.IDiv: { 
      instr =  `(i32.div_s (call $${GET_INT} ${leftObject}) (call $${GET_INT} ${rightObject}))`;
      break;
    }
    case BinOp.Mod: {  
      instr =  `(i32.rem_s (call $${GET_INT} ${leftObject}) (call $${GET_INT} ${rightObject}))`; 
      break;
    }
    case BinOp.Eq: {
      instr =  `(call $${EQ_PRIM} ${leftObject} ${rightObject} )`;
      break;
    }
    case BinOp.Neq: {
      instr =  `(call $${NEQ_PRIM} ${leftObject} ${rightObject} )`;
      break;
    }
    case BinOp.Lte: {
      instr =  `(i32.le_s (call $${GET_INT} ${leftObject}) (call $${GET_INT} ${rightObject}))`;
      break;
    }
    case BinOp.Gte: {
      instr =  `(i32.ge_s (call $${GET_INT} ${leftObject}) (call $${GET_INT} ${rightObject}))`;
      break;
    }
    case BinOp.Lt: {
      instr =  `(i32.lt_s (call $${GET_INT} ${leftObject}) (call $${GET_INT} ${rightObject}))`;
      break;
    }
    case BinOp.Gt: {
      instr =  `(i32.gt_s (call $${GET_INT} ${leftObject}) (call $${GET_INT} ${rightObject}))`;
      break;
    }
    case BinOp.Is: {
      instr =  `(i32.eq ${leftObject} ${rightObject})`;
      break;
    }
    case BinOp.And: {
      instr =  `(i32.and (call $${GET_BOOL} ${leftObject}) (call $${GET_BOOL} ${rightObject}))`;
      break;
    }
    case BinOp.Or: {
      instr =  `(i32.or (call $${GET_BOOL} ${leftObject}) (call $${GET_BOOL} ${rightObject}))`;
      break;
    }
  }



  if(boolResultOps.has(op)){
    return `(call $${ALLC_BOOL} ${instr})`;
  }
  return `(call $${ALLC_INT} ${instr})`;
}