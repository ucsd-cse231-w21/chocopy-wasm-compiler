import { run } from "./runner";
import { GlobalTable, tc } from "./type-check";
import { Value, Type, typeToString, Program, Literal, litToStr, valToStr } from "./ast";
import { parse } from "./parser";
import { builtinModules } from "module";
import { attachPresenter, BuiltInModule, gatherPresenters } from "./builtins/builtins";
import { ModulePresenter, ClassPresenter, FuncIdentity, idenToStr, literalToType } from "./types";
import { NONE } from "./utils";
import fs from 'fs';
import { MainAllocator, RuntimeModule } from "./heap";
import { compile, LabeledClass, LabeledModule } from "./compiler";
import { initializeBuiltins, SYSTEM_MODULE_NAME } from "./builtins/modules";

/**
 * Assigns unique WASM idenitifiers and variable indices
 * to modules - both builtins and source.
 */
class Labeler {

  curGVarIndex: number;
  curTypeCode: number;

  takenLabels: Map<string, number>;

  constructor(){
    this.curGVarIndex = 0;
    this.curTypeCode = 0;
    this.takenLabels = new Map();
  }

  /**
   * Labels a class
   * @param typeCode - the unique type code to assign to this class 
   * @param presenter - the ClassPresenter of this class
   * @param hostModule - the name of the host module of this class
   * 
   * @returns the LabeledClas representing this class
   */
  labelClass(typeCode: number, presenter: ClassPresenter, hostModule: string): LabeledClass{
    const vars = new Map<string, number>();
    const methods = new Map<string, {identity: FuncIdentity, label: string}>();

    const instanceVars = new Map<string, number>();
    let inVarIndex = 0;
    for(let name of presenter.instanceVars.keys()){
      vars.set(name, inVarIndex);
      inVarIndex++;
    }

    for(let m of presenter.instanceMethods.values()){
      const fName = m.signature.name;
      const label = this.genLabel(`${hostModule}_${presenter.name}_${fName}`);
      methods.set(idenToStr(m), {identity: m, label: label});
    }

    return {typeCode: typeCode, varIndices: vars, methods: methods};
  }

  /**
   * Labels this module
   * @param modCode - the unique type code to assign to this class
   * @param module - the ModulePresenter of this module
   * @param isSource - whether this Module is the source module or not
   */
  label(modCode: number, module: ModulePresenter, isSource: boolean): LabeledModule{
    let vIndex = isSource ? this.curGVarIndex : 0;

    const vars = new Map<string, number>();
    for(let name of module.moduleVars.keys()){
      vars.set(name, vIndex);
      vIndex++;
    }

    //update global var index if source module
    this.curGVarIndex = isSource ? vIndex : this.curGVarIndex;

    const funcs = new Map<string, {identity: FuncIdentity, label: string}>();
    for(let f of module.functions.values()){
      const fName = f.signature.name;
      const label = this.genLabel(`${module.name === undefined ? "" : module.name}_${fName}`);
      console.log(`  ** FOR FUNC ${idenToStr(f)}, the label is ${label}`);
      funcs.set(idenToStr(f), {identity: f, label: label});
    }

    const classes = new Map<string, LabeledClass>();
    let typeCode = isSource ? this.curTypeCode : 0;
    for(let c of module.classes.values()){
      const lclass = this.labelClass(typeCode, c, module.name === undefined ? "" : module.name);
      classes.set(c.name, lclass);
      typeCode++;
    }

    this.curTypeCode = isSource ? typeCode : this.curTypeCode;

    
    return {moduleCode: modCode, classes: classes, funcs: funcs, globalVars: vars};
  }

  /**
   * Generates a unique label, namely for functions
   * @param label - the proposed label name
   * 
   * @returns a unqiue version of such label
   */
  genLabel(label: string): string{
    if(this.takenLabels.has(label)){
      const currAddOn = this.takenLabels.get(label);
      this.takenLabels.set(label, currAddOn + 1);
      return label+(currAddOn + 1);
    }
    this.takenLabels.set(label, 0);
    return label;
  }
}

/**
 * Holds configuration assets for a REPL
 * 
 * This includes: type information of builtins - and callable code to builtin functions, 
 *                as well as the memory allocator to use for the REPL.
 */
export type Config = {
  builtIns: Map<string, BuiltInModule>,
  builtInPresenters: Map<string, ModulePresenter>,
  allocator: MainAllocator;
}

/**
 * The front-end interface of our ChocoPy Dialect compiler.
 */
export class BasicREPL {
  
  private config: Config;
  private labeler: Labeler;
  private labeledBuiltIns: Map<string, LabeledModule>;

  private currentLabels: LabeledModule;
  private currentSource: Program<Type>;
  private currentRuntime: RuntimeModule;
  private currentTable: GlobalTable;

  /**
   * Passed to WASM execution at runtime.
   * Collection of all callable functions in Type/Javscript
   * that can be called from WASM
   */
  private externalFuncs: any; 

  constructor(config: Config) {
    this.config = config;
    this.labeler = new Labeler();
    //this.labeler.init(config.builtIns);

    const runtime = this.createRuntime(this.config.allocator, this.labeler, config.builtIns);
    this.externalFuncs = runtime.funcs;
    this.labeledBuiltIns = runtime.labeledBuiltIns;
  }

  createRuntime(allocator: MainAllocator, labeler: Labeler, builtins: Map<string, BuiltInModule>) : 
                                              {funcs: any, labeledBuiltIns: Map<string, LabeledModule>}{
    const funcs: any = {};
    const labeledBuiltIns = new Map<string, LabeledModule>();                                    

    let modCode = 1; //we start at 1 as the module code 0 is reserved for the source module
    for(let [name, mod] of builtins.entries()){
      const labeledMod = labeler.label(modCode, mod.presenter, false);

      const modFuncs: any = {};

      for(let [_, func] of mod.functions.entries()){
        const sig = idenToStr(func.identity);
        const label = labeledMod.funcs.get(sig).label;
        modFuncs[label] = (...args: number[]) => {return func.func(...args)};
      }

      funcs[name] = modFuncs;
      labeledBuiltIns.set(name, labeledMod);
      modCode++;
    }

    //System functions related to memory manipulation
    funcs[SYSTEM_MODULE_NAME] = {
      instanciate: (code: number) => allocator.allocObj(0, code),
      objderef: (addr: number, index: number) => allocator.objRetr(addr, index),
      objmute: (addr: number, index: number, val: number) => allocator.objMutate(addr, index, val),
      modRef: (modCode: number, varIndex: number) => allocator.modVarRetr(modCode, varIndex),
      modMute: (modCode: number, index: number, val: number) => allocator.modVarMute(modCode, index, val),

      getInt: (addr: number) => allocator.getInt(addr),
      getBool: (addr: number) => allocator.getBool(addr),
      allocInt: (val: number) => allocator.allocInt(val),
      allocBool: (val: number) => allocator.allocBool(val)
    }

    return {funcs: funcs, labeledBuiltIns: labeledBuiltIns};
  }
  
  async run(source: string): Promise<Value> {
    source = "from natives import print, abs, min, max, pow \n" + source;

    const parsed = parse(source);
    const typed = tc(this.currentTable === undefined ? undefined : this.currentTable, 
                     this.config.builtInPresenters, 
                     parsed);

    this.currentSource = this.addOnComponents(this.currentSource, typed.typed);
    this.currentTable = typed.table;
    
    const labeled = this.labeler.label(0, typed.typed.presenter, true);
    
    //resolve labels
    this.currentLabels = this.resolveLabels(this.currentLabels, labeled);

    const compiled = compile(this.currentSource, this.currentLabels, this.labeledBuiltIns, this.config.allocator);
    //console.log("---------INSTRS--------\n"+compiled.join("\n"));

    this.currentRuntime = this.createRuntimeRep(this.currentRuntime, this.currentSource, labeled);
    this.config.allocator.setModule(0, this.currentRuntime);
    this.initGVars(this.currentSource, labeled);

    //console.log("-----executing!!!!");

    try {
      const v = await run(compiled.join("\n"), this.externalFuncs);
      if(v === 0){
        return {tag: "none"};
      }
      const inst = this.config.allocator.getInstance(v);
      switch(inst.tag){
        case "bool": return {tag: "bool", value: inst.value};
        case "string": return {tag: "string", value: inst.value};
        case "int": return {tag: "num", value: BigInt(inst.value)};
        case "instance": return {tag: "object", address: v}
      }
    } catch (error) {
      console.log("----EXECUTION ERROR CAUGHT-----");
      console.log(error.stack);
      throw error;
    }
  }

  addOnComponents(cur: Program<Type>, newProg: Program<Type>): Program<Type>{
    if(cur === undefined){
      return newProg;
    }

    const newPresenter: ModulePresenter = {
      name: cur.presenter.name,
      moduleVars: new Map([...cur.presenter.moduleVars, ...newProg.presenter.moduleVars]),
      functions: new Map([...cur.presenter.functions,...newProg.presenter.functions]),
      classes: new Map([...cur.presenter.classes,...newProg.presenter.classes])
    }

    const ret: Program<Type> = {
      funcs: new Map(cur.funcs),
      inits: new Map(newProg.inits),
      classes: new Map(cur.classes),
      imports: [...cur.imports, ...newProg.imports],
      stmts: newProg.stmts,
      presenter : newPresenter
    }

    return ret;
  }

  resolveLabels(curLabels: LabeledModule, newLabels: LabeledModule): LabeledModule{
    if(curLabels === undefined){
      return newLabels;
    }

    const result: LabeledModule = {
      moduleCode: curLabels.moduleCode,
      classes : new Map(curLabels.classes),
      funcs: new Map(curLabels.funcs), //maps function signatures to function labels
      globalVars: new Map(curLabels.globalVars) // maps global variables to their indices
    };

    Array.from(newLabels.classes.entries()).forEach(
      x => result.classes.set(x[0], x[1])
    );

    Array.from(newLabels.funcs.entries()).forEach(
      x => result.funcs.set(x[0], x[1])
    );

    Array.from(newLabels.globalVars.entries()).forEach(
      x => result.globalVars.set(x[0], x[1])
    );

    return result;
  }

  createRuntimeRep(curRuntime: RuntimeModule, program: Program<Type>, labeled: LabeledModule): RuntimeModule{
    const runtimeVers = {
      presenter: program.presenter,
      isBuiltin: false,
      classes: curRuntime === undefined ? new Map() : new Map(this.currentRuntime.classes),
      varNames: curRuntime === undefined ? new Map() : new Map(this.currentRuntime.varNames)
    };

    //add global vars
    for(let [name, index] of labeled.globalVars.entries()){
      runtimeVers.varNames.set(index, name);
    }

    //add classes
    for(let [name, labClass] of labeled.classes.entries()){
      //console.log(`  ---- SETTING RUNTIME, class: ${name} ${labClass.typeCode}`);

      const classDef = program.classes.get(name);
      const literals = new Array<Literal>();

      for(let [vName, _] of labClass.varIndices.entries()){
        //console.log(`     -> for ${vName}, literal is ${litToStr(classDef.fields.get(vName).value)}`);
        literals.push(classDef.fields.get(vName).value);
      } 

      runtimeVers.classes.set(labClass.typeCode, {vars: literals});
    }

    return runtimeVers;
  }

  initGVars(program: Program<Type>, labeled: LabeledModule){
    for(let [name, def] of program.inits.entries()){
      this.config.allocator.addNewGVar(0, name, def.type);

      let initValue = 0;
      switch(def.value.tag){
        case "bool": {
          initValue = this.config.allocator.allocBool(def.value.value ? 1 : 0);
          break;
        }
        case "string": {
          initValue = this.config.allocator.allocStr(def.value.value);
          break;
        }
        case "num": {
          initValue = this.config.allocator.allocInt(Number(def.value.value));
          break;
        }
        case "none": {
          break;
        }
      }

      this.config.allocator.modVarMute(0, labeled.globalVars.get(name), initValue);
    }
  }

  async tc(source: string): Promise<Type> {
    source = "from natives import print, abs, min, max, pow \n" + source;

    const parsed = parse(source);
    const typed = tc(this.currentTable === undefined ? 
                          undefined :  
                          this.currentTable, this.config.builtInPresenters, parsed);
    const lastStmt = typed.typed.stmts[typed.typed.stmts.length - 1];

    //console.log(` LAST STMT , is expr? ${lastStmt.tag} ${JSON.stringify(lastStmt)}`);
    if(lastStmt.tag === "expr"){
      return lastStmt.a;
    }
    return NONE;
  }


}

/*
async function main(){
  const allocator = new MainAllocator();
  const builtIns = initializeBuiltins(allocator);
  allocator.initGlobalVars(builtIns.modules.size); //natives, otherModule, and source
  

  const config: Config = {builtIns: builtIns.modules, 
                          builtInPresenters: builtIns.presenters, 
                          allocator: allocator};
  const repl = new BasicREPL(config);

  const input = fs.readFileSync("./sampleprogs/sample8.txt","ascii");

  let v = await repl.run(input);
  console.log("done============="+valToStr(v));
  
  //console.log("last type: "+typeToString(v));

  
  var stdin = process.openStdin();
  stdin.addListener("data", async function(d) {
      // note:  d is an object, and when converted to a string it will
      // end with a linefeed.  so we (rather crudely) account for that  
      // with toString() and then substring() 
      const code = d.toString().trim();
      console.log("you entered: [" + code + "]");
      try {
        let v = await repl.run(code);
        console.log("       ===> result "+valToStr(v));
      } catch (error) {
        console.log("last caught! ");
        console.log(error.stack);
      }
  });
  
 
}

try {
  main();
} catch (error) {
  console.log("last caught! ");
  console.log(error.stack);
}
*/