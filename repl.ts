import { run, Config } from "./runner";
import { GlobalEnv } from "./compiler";
import { tc, defaultTypeEnv, GlobalTypeEnv } from "./type-check";
import { Value, Type } from "./ast";
import { parse } from "./parser";
import { importMemoryManager, MemoryManager } from "./alloc";

interface REPL {
  run(source: string): Promise<any>;
}

export class BasicREPL {
  currentEnv: GlobalEnv;
  currentTypeEnv: GlobalTypeEnv;
  functions: string;
  importObject: any;
  memory: any;
  memoryManager: MemoryManager;
  constructor(importObject: any) {
    this.importObject = importObject;
    if (!importObject.js) {
      const memory = new WebAssembly.Memory({ initial: 2000, maximum: 2000 });

      this.importObject.js = { memory: memory };
    }

    if (!importObject.memoryManager) {
      const memory = this.importObject.js.memory;
      const memoryManager = new MemoryManager(new Uint8Array(memory.buffer), {
        staticStorage: 512n,
        total: 2000n,
      });
      this.memoryManager = memoryManager;
      importMemoryManager(this.importObject, memoryManager);
    }
    this.currentEnv = {
      globals: new Map(),
      classes: new Map(),
      locals: new Map(),
    };
    this.currentTypeEnv = defaultTypeEnv;
    this.functions = "";
  }
  async run(source: string): Promise<Value> {
    const config: Config = {
      importObject: this.importObject,
      env: this.currentEnv,
      typeEnv: this.currentTypeEnv,
      functions: this.functions,
      memoryManager: this.memoryManager,
    };
    const [result, newEnv, newTypeEnv, newFunctions] = await run(source, config);
    this.currentEnv = newEnv;
    this.currentTypeEnv = newTypeEnv;
    this.functions += newFunctions;
    return result;
  }
  async tc(source: string): Promise<Type> {
    const config: Config = {
      importObject: this.importObject,
      env: this.currentEnv,
      typeEnv: this.currentTypeEnv,
      functions: this.functions,
      memoryManager: this.memoryManager,
    };
    const parsed = parse(source);
    const [result, _] = await tc(this.currentTypeEnv, parsed);
    return result.a;
  }
}
