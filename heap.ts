import { ClassPresenter, ModulePresenter } from "./types";
import { Value, Type } from "./ast";
import {BuiltVariable} from "./builtins/builtins";
import { add } from "cypress/types/lodash";

export type RuntimeModule = {
  presenter: ModulePresenter,
  builtInVariable: Array<BuiltVariable>,
  classes: Map<number, ClassPresenter>
}

export interface MemoryAllocator {

  allocate(typeCode: number) : number;

  staticStrAllocate(str: string) : number;

  intAllocate(int: number) : number;

  boolAllocate(b: boolean) : number;

  getInt(intAddress: number) : number;

  getBool(boolAdress: number) : number;

  attrLookup(objAddress: number, attrIndex: number) : number;

  attrMutate(objAddress: number, attrIndex: number, newVal: number) : void;

  globalRetr(moduleCode: number, varIndex: number) : number;

  globalMutate(moduleCode: number, varIndex: number, newValue: number) : void;
}

export class MainAllocator implements MemoryAllocator{

  private globalVars: Array<number>; //by module. module 0 is the main module

  private heap: Array<{type: number, attrs: Array<number>}>;
  private heapIndex: number;

  private modules: Map<number, RuntimeModule>;

  constructor(allModules: Map<number, RuntimeModule>){
    this.modules = allModules;
    this.globalVars = new Array();
    this.heap = new Array(2); //we start with an array of size 2. Index 0 is None
    this.heapIndex = 1;
  }

  allocate(typeCode: number) : number{
    //assumed current module
    const currClass = this.modules.get(0).classes.get(typeCode);
    const address = this.heapIndex;

    const attrs = new Array<number>();
    for(let [name, info] of currClass.instanceVars.entries()){
      switch(info.initValue.tag){
        case "num": {
          attrs.push(this.intAllocate(Number(info.initValue.value)));
          break;
        }
        case "bool": {
          attrs.push(this.boolAllocate(info.initValue.value));
          break;
        }
        case "string": {
          attrs.push(this.staticStrAllocate(info.initValue.value));
          break;
        }
        default: {
          attrs.push(0);  //this is None
          break;
        }
      }
    }

    const instance = {type: typeCode, attrs: attrs};
    this.heap.push(instance);
    this.heapIndex++;
    return address;
  }

  staticStrAllocate(str: string) : number {
    const address = this.heapIndex;
    const charArray = new Array<number>(str.length + 1);

    //first attr on string is the length
    charArray.push(str.length);
    for(let i = 0; i < charArray.length; i++){
      charArray[i] = str.codePointAt(i);
    }

    const strInstance = {
      type: 2,
      attrs: charArray
    }

    this.heap.push(strInstance);
    this.heapIndex++;
    return address;
  }

  intAllocate(int: number) : number{
    const address = this.heapIndex;
    const intValue = {
      type: 0,
      attrs: [int]
    };

    this.heap.push(intValue);
    this.heapIndex++;
    return address;
  }

  boolAllocate(b: boolean) : number {
    const address = this.heapIndex;
    const boolValue = {
      type: 1,
      attrs: [b ? 1 : 0]
    };

    this.heap.push(boolValue);
    this.heapIndex++;
    return address;
  }

  getInt(intAddress: number) : number {
    if(intAddress === 0){
      throw new Error("None dereference");
    }
    const intObject = this.heap[intAddress];
    return intObject.attrs[0];
  }

  getBool(boolAdress: number) : number {
    if(boolAdress === 0){
      throw new Error("None dereference");
    }
    const boolObject = this.heap[boolAdress];
    return boolObject.attrs[0];
  }

  attrLookup(objAddress: number, attrIndex: number) : number{
    if(objAddress === 0){
      throw new Error("Runtime error! None object target of attribute lookup");
    }

    const obj = this.heap[objAddress];
    return obj.attrs[attrIndex];
  }

  attrMutate(objAddress: number, attrIndex: number, newVal: number) : void {
    if(objAddress === 0){
      throw new Error("Runtime error! None object target of attribute mutation");
    }

    const obj = this.heap[objAddress];
    obj.attrs[attrIndex] = newVal;
  }

  globalRetr(moduleCode: number, varIndex: number) : number{
    if(moduleCode === 0){
      const globalVar = this.globalVars[varIndex];
      return globalVar;
    }
    const targetModule = this.modules.get(moduleCode);
    const gVar = targetModule.builtInVariable[varIndex];
    return gVar.get();
  }

  globalMutate(moduleCode: number, varIndex: number, newValue: number) : void{
    if(moduleCode === 0){
      this.globalVars[varIndex] = newValue;
    }
    else{
      const targetModule = this.modules.get(moduleCode);
      const gVar = targetModule.builtInVariable[varIndex];
      gVar.set(newValue);
    }
  }

}