import { run, Config } from "./runner";
import { GlobalEnv, libraryFuns, ListContentTag } from "./compiler";
import { tc, defaultTypeEnv, GlobalTypeEnv } from "./type-check";
import { Value, Type, Literal } from "./ast";
import { parse } from "./parser";
import { NUM, STRING, BOOL, NONE, LIST, CLASS, CALLABLE, PyValue } from "./utils";
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
    this.importObject.imports.__internal_print_list = (arg: number, typ: ListContentTag) => {
      console.log("Logging from WASM: ", arg);
      switch(typ) {
        case ListContentTag.Num:
          this.importObject.imports.print(
            PyValue(LIST(NUM), arg, new Uint32Array(this.importObject.js.memory.buffer))
          );
          break;
        case ListContentTag.Bool:
          this.importObject.imports.print(
            PyValue(LIST(BOOL), arg, new Uint32Array(this.importObject.js.memory.buffer))
          );
          break;
        //Realistically can never happen
        case ListContentTag.None:
          this.importObject.imports.print(
            PyValue(LIST(NONE), arg, new Uint32Array(this.importObject.js.memory.buffer))
          );
          break;
        case ListContentTag.Str:
          this.importObject.imports.print(
            PyValue(LIST(STRING), arg, new Uint32Array(this.importObject.js.memory.buffer))
          );
          break;
        //We didn't actually store the name of the class anywhere
        //This will display as "<list<class> object at N>"
        case ListContentTag.Class:
          this.importObject.imports.print(
            PyValue(LIST(CLASS("class")), arg, new Uint32Array(this.importObject.js.memory.buffer))
          );
          break;
        //Doesn't display type of inner list
        //This will display as "<list<list> object at N>"
        case ListContentTag.List:
          this.importObject.imports.print(
            PyValue(LIST(LIST(null)), arg, new Uint32Array(this.importObject.js.memory.buffer))
          );
          break;
        //TODO: Placeholder for Dict
        case ListContentTag.Dict:
          this.importObject.imports.print(
            PyValue(LIST(LIST(null)), arg, new Uint32Array(this.importObject.js.memory.buffer))
          );
          break;
        //TODO: Placeholder for Callable
        case ListContentTag.Callable:
          this.importObject.imports.print(
            PyValue(LIST(NUM), arg, new Uint32Array(this.importObject.js.memory.buffer))
          );
      }
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

    // initialization for range() calss and its constructor.
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
