import { run, Config } from "./runner";
import { GlobalEnv, libraryFuns, ListContentTag } from "./compiler";
import { tc, defaultTypeEnv, GlobalTypeEnv } from "./type-check";
import { Value, Type, Literal } from "./ast";
import { parse } from "./parser";
import { importMemoryManager, MemoryManager } from "./alloc";
import { bignumfunctions } from "./bignumfunctions";
import {
  NUM,
  STRING,
  BOOL,
  NONE,
  LIST,
  CLASS,
  PyValue,
  stringify,
  PyString,
  PyBigInt,
  PyBool,
  encodeValue,
} from "./utils";
import { InternalException } from "./error";
import { ErrorManager, importErrorManager } from "./errorManager";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface REPL {
  run(source: string): Promise<any>;
}

export class BasicREPL {
  currentEnv: GlobalEnv;
  currentTypeEnv: GlobalTypeEnv;
  functions: string;
  importObject: any;
  memory: any;
  errorManager: ErrorManager;
  memoryManager: MemoryManager;
  constructor(importObject: any) {
    this.importObject = importObject;
    this.errorManager = new ErrorManager();
    if (!importObject.js) {
      const memory = new WebAssembly.Memory({ initial: 2000, maximum: 2000 });
      const view = new Int32Array(memory.buffer);
      view[0] = 4;
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
    this.importObject.imports.__internal_print_none = (arg: number) => {
      console.log("Logging from WASM: ", arg);
      this.importObject.imports.print(PyValue(NONE, arg, null));
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
      let mem = new Uint32Array(this.importObject.js.memory.buffer);
      const view = new Int32Array(mem);
      let list_length = view[arg / 4 + 1];
      //let list_bound = view[arg / 4 + 2];
      var base_str = "";
      var index = 0;
      let p_list = [];

      while (index < list_length) {
        switch (typ) {
          case ListContentTag.Num:
            base_str = stringify(PyValue(LIST(NUM), arg, mem));
            p_list.push(stringify(PyValue(NUM, view[arg / 4 + 3 + index], mem)));
            break;
          case ListContentTag.Bool:
            base_str = stringify(PyValue(LIST(BOOL), arg, mem));
            p_list.push(stringify(PyValue(BOOL, view[arg / 4 + 3 + index], mem)));
            break;
          //Realistically can never happen
          case ListContentTag.None:
            base_str = stringify(PyValue(LIST(NONE), arg, mem));
            p_list.push(stringify(PyValue(NONE, view[arg / 4 + 3 + index], mem)));
            break;
          //We didn't actually store the name of the class anywhere
          //This will display as "<list<class> object at N>"
          case ListContentTag.Str:
            base_str = stringify(PyValue(LIST(STRING), arg, mem));
            p_list.push(stringify(PyValue(STRING, view[arg / 4 + 3 + index], mem)));
            break;
          case ListContentTag.Class:
            base_str = stringify(PyValue(LIST(CLASS("class")), arg, mem));
            p_list.push(stringify(PyValue(CLASS("CLASS"), view[arg / 4 + 3 + index], mem)));
            break;
          //Doesn't display type of inner list
          //This will display as "<list<list> object at N>"
          case ListContentTag.List:
            base_str = stringify(PyValue(LIST(LIST(null)), arg, mem));
            p_list.push(stringify(PyValue(LIST(LIST(null)), view[arg / 4 + 3 + index], mem)));
            break;
          //TODO: Placeholder for Dict
          case ListContentTag.Dict:
            base_str = stringify(PyValue(LIST(LIST(null)), arg, mem));
            p_list.push(stringify(PyValue(CLASS("Dict"), view[arg / 4 + 3 + index], mem)));
            break;
          //TODO: Placeholder for Callable
          case ListContentTag.Callable:
            base_str = stringify(PyValue(LIST(NUM), arg, mem));
            p_list.push(stringify(PyValue(CLASS("Callable"), view[arg / 4 + 3 + index], mem)));
            break;
        }
        index += 1;
      }

      this.importObject.imports.print(PyString(`${base_str} [ ${p_list.join(", ")} ]`, arg));

      return arg;
    };
    this.importObject.imports.__internal_print_bool = (arg: number) => {
      console.log("Logging from WASM: ", arg);
      this.importObject.imports.print(PyValue(BOOL, arg, null));
      return arg;
    };
    this.importObject.imports.abs = (arg: number) =>
      this.uniOpInterface(arg, (val: bigint) => {
        return val < 0 ? -val : val;
      });
    this.importObject.imports.pow = (base: number, exp: number) =>
      this.binOpInterface(base, exp, (baseVal: bigint, expVal: bigint) => {
        // Javascript does not allow a negative BigInt exponent.
        if (expVal < 1) {
          return 0n;
        } else {
          return baseVal ** expVal;
        }
      });
    this.importObject.imports.max = (x: number, y: number) =>
      this.binOpInterface(x, y, (xval: bigint, yval: bigint) => {
        var res = xval > yval ? xval : yval;
        return res;
      });
    this.importObject.imports.min = (x: number, y: number) =>
      this.binOpInterface(x, y, (xval: bigint, yval: bigint) => {
        var res = xval < yval ? xval : yval;
        return res;
      });
    this.importObject.imports.__big_num_add = (x: number, y: number) =>
      this.binOpInterface(x, y, (x: bigint, y: bigint) => {
        return x + y;
      });
    this.importObject.imports.__big_num_sub = (x: number, y: number) =>
      this.binOpInterface(x, y, (x: bigint, y: bigint) => {
        return x - y;
      });
    this.importObject.imports.__big_num_mul = (x: number, y: number) =>
      this.binOpInterface(x, y, (x: bigint, y: bigint) => {
        return x * y;
      });
    this.importObject.imports.__big_num_div = (x: number, y: number) =>
      this.binOpInterface(x, y, (x: bigint, y: bigint) => {
        if (y === 0n) {
          // TODO change this back to ZeroDivisionError
          throw new Error("Cannot divide by zero");
          //           throw new ZeroDivisionError();
        }
        return (x - (((x % y) + y) % y)) / y;
      });
    this.importObject.imports.__big_num_mod = (x: number, y: number) =>
      this.binOpInterface(x, y, (x: bigint, y: bigint) => {
        return ((x % y) + y) % y;
      });
    this.importObject.imports.__big_num_eq = (x: number, y: number) =>
      this.binOpInterfaceBool(x, y, (x: bigint, y: bigint) => {
        return x === y;
      });
    this.importObject.imports.__big_num_ne = (x: number, y: number) =>
      this.binOpInterfaceBool(x, y, (x: bigint, y: bigint) => {
        return x !== y;
      });
    this.importObject.imports.__big_num_lt = (x: number, y: number) =>
      this.binOpInterfaceBool(x, y, (x: bigint, y: bigint) => {
        return x < y;
      });
    this.importObject.imports.__big_num_lte = (x: number, y: number) =>
      this.binOpInterfaceBool(x, y, (x: bigint, y: bigint) => {
        return x <= y;
      });
    this.importObject.imports.__big_num_gt = (x: number, y: number) =>
      this.binOpInterfaceBool(x, y, (x: bigint, y: bigint) => {
        return x > y;
      });
    this.importObject.imports.__big_num_gte = (x: number, y: number) =>
      this.binOpInterfaceBool(x, y, (x: bigint, y: bigint) => {
        return x >= y;
      });

    importErrorManager(this.importObject, this.errorManager);

    // initialization for range() calss and its constructor.
    const classFields: Map<string, [number, Literal]> = new Map();
    classFields.set("cur", [0, { tag: "num", value: BigInt(0) }]);
    classFields.set("stop", [1, { tag: "num", value: BigInt(0) }]);
    classFields.set("step", [2, { tag: "num", value: BigInt(1) }]);
    this.currentEnv.classes.set("Range", classFields);
    this.currentTypeEnv = defaultTypeEnv;
    this.functions = libraryFuns() + "\n\n" + bignumfunctions;
  }
  binOpInterface(x: number, y: number, f: (x: bigint, y: bigint) => bigint): number {
    var mem = new Uint32Array(this.importObject.js.memory.buffer);
    var xval = PyValue(NUM, x, mem);
    var yval = PyValue(NUM, y, mem);
    if (xval.tag == "num" && yval.tag == "num") {
      return encodeValue(
        PyBigInt(f(xval.value, yval.value)),
        this.importObject.imports.gcalloc,
        mem
      );
    }
    throw new InternalException("binary operation failed at runtime");
  }
  binOpInterfaceBool(x: number, y: number, f: (x: bigint, y: bigint) => boolean): number {
    var mem = new Uint32Array(this.importObject.js.memory.buffer);
    var xval = PyValue(NUM, x, mem);
    var yval = PyValue(NUM, y, mem);
    if (xval.tag == "num" && yval.tag == "num") {
      return encodeValue(PyBool(f(xval.value, yval.value)), this.importObject.imports.gcalloc, mem);
    }
    throw new InternalException("binary operation failed at runtime");
  }
  uniOpInterface(x: number, f: (x: bigint) => bigint): number {
    var mem = new Uint32Array(this.importObject.js.memory.buffer);
    var xval = PyValue(NUM, x, mem);
    if (xval.tag == "num") {
      return encodeValue(PyBigInt(f(xval.value)), this.importObject.imports.gcalloc, mem);
    }
    throw new InternalException("binary operation failed at runtime");
  }
  async run(source: string): Promise<Value> {
    const config: Config = {
      importObject: this.importObject,
      env: this.currentEnv,
      typeEnv: this.currentTypeEnv,
      functions: this.functions,
      errorManager: this.errorManager,
      memoryManager: this.memoryManager,
    };
    const [result, newEnv, newTypeEnv, newFunctions, newErrorManager] = await run(source, config);
    this.currentEnv = newEnv;
    this.currentTypeEnv = newTypeEnv;
    this.functions += newFunctions;
    this.errorManager = newErrorManager;

    this.memoryManager.forceCollect();
    return result;
  }
  async tc(source: string): Promise<Type> {
    const config: Config = {
      importObject: this.importObject,
      env: this.currentEnv,
      typeEnv: this.currentTypeEnv,
      functions: this.functions,
      errorManager: this.errorManager,
      memoryManager: this.memoryManager,
    };
    const parsed = parse(source, config);
    const [result, _] = await tc(this.currentTypeEnv, parsed);
    return result.a[0];
  }
}
