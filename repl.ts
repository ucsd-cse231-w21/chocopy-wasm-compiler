import { run, Config } from "./runner";
import { GlobalEnv, libraryFuns } from "./compiler";
import { tc, defaultTypeEnv, GlobalTypeEnv } from "./type-check";
import { Value, Type, Literal } from "./ast";
import { parse } from "./parser";

interface REPL {
  run(source: string): Promise<any>;
}

export class BasicREPL {
  currentEnv: GlobalEnv;
  currentTypeEnv: GlobalTypeEnv;
  functions: string;
  importObject: any;
  memory: any;
  constructor(importObject: any) {
    this.importObject = importObject;
    if (!importObject.js) {
      const memory = new WebAssembly.Memory({ initial: 2000, maximum: 2000 });
      const view = new Int32Array(memory.buffer);
      view[0] = 4;
      this.importObject.js = { memory: memory };
    }
    this.currentEnv = {
      globals: new Map(),
      classes: new Map(),
      locals: new Set(),
      offset: 1,
      funs: new Map(),
    };

    // initialization for range() calss and its constructor.
    const classFields: Map<string, [number, Literal]> = new Map();
    classFields.set("cur", [0, { tag: "num", value: BigInt(0) }]);
    classFields.set("stop", [1, { tag: "num", value: BigInt(0) }]);
    classFields.set("step", [2, { tag: "num", value: BigInt(1) }]);
    this.currentEnv.classes.set("Range", classFields);

    this.currentTypeEnv = defaultTypeEnv;
    this.functions = libraryFuns();
  }
  async run(source: string): Promise<Value> {
    const config: Config = {
      importObject: this.importObject,
      env: this.currentEnv,
      typeEnv: this.currentTypeEnv,
      functions: this.functions,
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
    };
    const parsed = parse(source);
    const [result, _] = await tc(this.currentTypeEnv, parsed);
    return result.a[0];
  }
}
