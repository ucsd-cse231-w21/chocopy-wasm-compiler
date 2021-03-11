import { run, Config } from "./runner";
import { GlobalEnv, libraryFuns } from "./compiler";
import { tc, defaultTypeEnv, GlobalTypeEnv } from "./type-check";
import { Value, Type, Literal } from "./ast";
import { parse } from "./parser";
import { importMemoryManager, MemoryManager } from "./alloc";
import { NUM, STRING, BOOL, NONE, PyValue } from "./utils";
import { bignumfunctions } from "./bignumfunctions";

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
      funs: new Map(),
    };
    this.importObject.imports.__internal_print = (arg: any) => {
      console.log("Logging from WASM: ", arg);
      this.importObject.imports.print(
        PyValue(NUM, arg, new Uint32Array(this.importObject.js.memory.buffer))
      );
      return arg;
    };
    this.importObject.imports.__internal_print_num = (arg: number) => {
      console.log("Logging from WASM: ", arg);
      this.importObject.imports.print(
        PyValue(NUM, arg, new Uint32Array(this.importObject.js.memory.buffer))
      );
      return arg;
    };
    this.importObject.imports.__internal_print_str = (arg: number) => {
      console.log("Logging from WASM: ", arg);
      this.importObject.imports.print(
        PyValue(STRING, arg, new Uint32Array(this.importObject.js.memory.buffer))
      );
      return arg;
    };
    this.importObject.imports.__internal_print_bool = (arg: number) => {
      console.log("Logging from WASM: ", arg);
      this.importObject.imports.print(PyValue(BOOL, arg, null));
      return arg;
    };
    this.importObject.imports.__internal_print_none = (arg: number) => {
      console.log("Logging from WASM: ", arg);
      this.importObject.imports.print(PyValue(NONE, arg, null));
      return arg;
    };

    // initialization for range() class and its constructor.
    const classFields: Map<string, [number, Literal]> = new Map();
    classFields.set("cur", [0, { tag: "num", value: BigInt(0) }]);
    classFields.set("stop", [1, { tag: "num", value: BigInt(0) }]);
    classFields.set("step", [2, { tag: "num", value: BigInt(1) }]);
    this.currentEnv.classes.set("Range", classFields);

    this.currentTypeEnv = defaultTypeEnv;
    this.functions = libraryFuns() + "\n\n" + bignumfunctions;
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
    return result.a[0];
  }
}
