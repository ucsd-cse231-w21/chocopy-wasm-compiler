import { ClassPresenter, ModulePresenter } from "./types";
import { Value, Type, Literal } from "./ast";
import {BuiltInModule, BuiltVariable} from "./builtins/builtins";

export type RuntimeModule = {
  presenter: ModulePresenter,
  isBuiltin: boolean,
  classes: Map<number, {vars: Array<Literal>}>,
  varNames: Map<number, string>
}

/*
 Represents a runtime instance of a class
 */
export type Instance =
 | {tag: "int", value: number}
 | {tag: "bool", value: boolean}
 | {tag: "string", value: string}
 | {tag: "instance", moduleCode: number, typeCode: number, attrs: Array<number>}

export class MainAllocator{

  private globalVars: Array<Array<BuiltVariable>>; //by module. module 0 is the main module

  private heap: Array<Instance>;
  private heapIndex: number;

  private typesByModule: Map<number, RuntimeModule>;

  constructor(){
    this.heap = [undefined]; //we start with an array of size 2. Index 0 is None
    this.typesByModule = new Map();
    this.heapIndex = 1;
  }

  initGlobalVars(totalModules: number){
    this.globalVars = new Array(totalModules);
    for(let i = 0; i < totalModules; i++){
      this.globalVars[i] = [];
    }
  }

  doesTypeExists(modCode: number, typeCode: number): boolean {
    return this.typesByModule.get(modCode).classes.has(typeCode);
  }

  setModule(modCode: number, module: RuntimeModule){
    this.typesByModule.set(modCode, module);
  }

  addNewType(modCode: number, typeCode: number, initValues: Array<Literal>){
    this.typesByModule.get(modCode).classes.set(typeCode, {vars: initValues});
  }

  addNewGVar(modCode: number, name: string, type: Type){
    this.globalVars[modCode].push(new BuiltVariable(name, type));
  }

  getInstance(addr: number): Instance{
    return this.heap[addr];
  }

  getInt(addr: number): number {
    const intInstance = this.heap[addr];
    if(intInstance.tag !== "int"){
      throw new Error("Fatal error: Attempt to deref object at "+addr+" to int.");
    }
    return intInstance.value;
  }

  getBool(addr: number): number {
    const intInstance = this.heap[addr];
    if(intInstance.tag !== "bool"){
      throw new Error("Fatal error: Attempt to deref object at "+addr+" to bool.");
    }
    return intInstance.value ? 1 : 0;
  }

  getStr(addr: number): string {
    const intInstance = this.heap[addr];
    if(intInstance.tag !== "string"){
      throw new Error("Fatal error: Attempt to deref object at "+addr+" to string.");
    }
    return intInstance.value;
  }

  modVarMute(modCode: number, vIndex: number, newVal: number): void{
    const module = this.globalVars[modCode];
    module[vIndex].set(newVal);
  }

  modVarRetr(modCode: number, vIndex: number): number{
    //console.log(` =====> runtime: Retrieving gvar of mod ${modCode} at index ${vIndex}`);
    const module = this.globalVars[modCode];

    return module[vIndex].get();
  }

  objMutate(addr: number, index: number, newVal: number) : void{
    const instance = this.heap[addr];
    if(instance.tag !== "instance"){
      throw new Error("Fatal Error! Object at address "+addr+" has no attributes!");
    }

    instance.attrs[index] = newVal;
  }

  objRetr(addr: number, index: number): number{
    const instance = this.heap[addr];
    if(instance.tag !== "instance"){
      throw new Error("Fatal Error! Object at address "+addr+" has no attributes!");
    }

    return instance.attrs[index];
  }

  allocObj(modCode: number, typeCode: number): number{
    const module = this.typesByModule.get(modCode);
    const targetClass = module.classes.get(typeCode);

    const attrs = new Array<number>();
    //console.log(`------Runtime instanciating ${modCode} ${typeCode} , ${targetClass.vars.length}`);
    
    for(let initValue of targetClass.vars){
      switch(initValue.tag){
        case "bool": {
          const alloc = this.allocBool(initValue.value ? 1 : 0);
          attrs.push(alloc);
          break;
        }
        case "string": {
          const alloc = this.allocStr(initValue.value);
          attrs.push(alloc);
          break;
        }
        case "num": {
          const alloc = this.allocInt(Number(initValue.value));
          attrs.push(alloc);
          break;
        }
        case "none": {
          attrs.push(0);
          break;
        }
      }
    }
    

    const addr = this.heapIndex;
    this.heap.push({tag: "instance", moduleCode: modCode, typeCode: typeCode, attrs: attrs});
    this.heapIndex++;
    return addr;
  }

  allocStr(str: string): number{
    const addr = this.heapIndex;

    this.heap.push({tag: "string", value: str});
    this.heapIndex++;
    return addr;
  }

  allocBool(bool: number): number{
    const addr = this.heapIndex;

    this.heap.push({tag: "bool", value: bool === 0 ? false: true});
    this.heapIndex++;
    return addr;
  }

  allocInt(int: number): number{
    const addr = this.heapIndex;

    this.heap.push({tag: "int", value: int});
    this.heapIndex++;
    return addr;
  }
}