import { ClassType } from "./ast";
import { MEM_SIZE } from "./constant";

export class MemoryManager {
  dispatchTablesSize = 0;

  functionIdToName: Array<string> = new Array();
  functionNameToId: Map<string, number> = new Map();

  classTagToClassType: Array<ClassType> = new Array();
  classNameToTag: Map<string, number> = new Map();

  memory = new WebAssembly.Memory({ initial: MEM_SIZE, maximum: MEM_SIZE });

  initialized = false;
  functionSource = "";

  collectFunc(globalName: string) {
    this.functionNameToId.set(globalName, this.functionIdToName.length);
    this.functionIdToName.push(globalName);
  }
}
