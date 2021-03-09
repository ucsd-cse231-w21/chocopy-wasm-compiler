import { ClassPresenter, ModulePresenter } from "./types";
import { Value, Type } from "./ast";
import {BuiltInModule, BuiltVariable} from "./builtins/builtins";
import { add, values } from "cypress/types/lodash";

export type RuntimeModule = {
  presenter: ModulePresenter,
  builtInVariable: Array<BuiltVariable>,
  classes: Map<number, ClassPresenter>
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

  private modules: Map<number, RuntimeModule>;

  constructor(){}

  init(modules: Map<number, RuntimeModule>){
    this.modules = modules;

    this.globalVars = new Array(modules.size).fill([]);

    
    this.heap = [undefined]; //we start with an array of size 2. Index 0 is None
    this.heapIndex = 1;
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
    const module = this.modules.get(modCode);
    const targetClass = module.classes.get(typeCode);

    const attrs = new Array<number>();
    for(let [_, info] of targetClass.instanceVars.entries()){
      switch(info.initValue.tag){
        case "bool": {
          const alloc = this.allocBool(info.initValue.value ? 1 : 0);
          attrs.push(alloc);
          break;
        }
        case "string": {
          const alloc = this.allocStr(info.initValue.value);
          attrs.push(alloc);
          break;
        }
        case "num": {
          const alloc = this.allocInt(Number(info.initValue.value));
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