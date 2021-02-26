import { run, Config } from "./runner";
import { GlobalEnv } from "./compiler";
import { tc, defaultTypeEnv, GlobalTypeEnv } from "./type-check";
import { Value, Type } from "./ast";
import { parse } from "./parser";

interface REPL {
  run(source : string) : Promise<any>;
}

export class BasicREPL {
  currentEnv: GlobalEnv
  currentTypeEnv: GlobalTypeEnv
  functions: string
  importObject: any
  memory: any
  constructor(importObject : any) {
    this.importObject = importObject;
    if(!importObject.js) {
      const memory = new WebAssembly.Memory({initial:2000, maximum:2000});
      const view = new Int32Array(memory.buffer);
      view[0] = 4;
      this.importObject.js = { memory: memory };
    }
    this.currentEnv = {
      globals: new Map(),
      classes: new Map(),
      locals: new Set(),
      offset: 1
    };
    this.currentTypeEnv = defaultTypeEnv;
      this.functions = "";

    // Calculate the length of a string using its heap pointer
    this.importObject.imports.str_len = (offBigInt: any): any => {
      // untag the pointer
      const off: number = Number(offBigInt - STR_BI);

      // Get pointer to the WASM shared memory
      const memBuffer: ArrayBuffer = (importObject as any).js.memory.buffer;
      const memUint8 = new Uint8Array(memBuffer);

      // Loop until the NULL character
      var iter = off*8;
      while (memUint8[iter] != 0) {
	iter += 1;
      }

      return BigInt(iter - off*8);
    };
  }
  async run(source : string) : Promise<Value> {
    const config : Config = {importObject: this.importObject, env: this.currentEnv, typeEnv: this.currentTypeEnv, functions: this.functions};
    const [result, newEnv, newTypeEnv, newFunctions] = await run(source, config);
    this.currentEnv = newEnv;
    this.currentTypeEnv = newTypeEnv;
    this.functions += newFunctions;
    return result;
  }
  async tc(source: string): Promise<Type> {
    const config: Config = { importObject: this.importObject, env: this.currentEnv, typeEnv: this.currentTypeEnv, functions: this.functions };
    const parsed = parse(source);
    const [result, _] = await tc(this.currentTypeEnv, parsed);
    return result.a;
  }
}
