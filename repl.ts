import { run, Config } from "./runner";
// import { GlobalEnv } from "./compiler";
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
      labels: [],
      offset: 1
    };
    this.currentTypeEnv = defaultTypeEnv;
    this.functions = "";
  }
  async run(source : string) : Promise<Value> {
    const config : Config = {importObject: this.importObject, env: this.currentEnv, typeEnv: this.currentTypeEnv, functions: this.functions};
    const [result, newEnv, newTypeEnv, newFunctions, instance] = await run(source, config);
    this.currentEnv = newEnv;
    this.currentTypeEnv = newTypeEnv;
    this.functions += newFunctions;
    const currentGlobals = this.importObject.env || {};
    console.log(instance);
    Object.keys(instance.instance.exports).forEach(k => {
      console.log("Consider key ", k);
      const maybeGlobal = instance.instance.exports[k];
      if(maybeGlobal instanceof WebAssembly.Global) {
        currentGlobals[k] = maybeGlobal;
      }
    });
    this.importObject.env = currentGlobals;
    return result;
  }
  tc(source: string): Type {
    const config: Config = { importObject: this.importObject, env: this.currentEnv, typeEnv: this.currentTypeEnv, functions: this.functions };
    const parsed = parse(source);
    const [result, _] = tc(this.currentTypeEnv, parsed);
    return result.a;
  }
}