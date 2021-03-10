import { run, Config } from "./runner";
import { GlobalEnv, libraryFuns, ListContentTag } from "./compiler";
import { tc, defaultTypeEnv, GlobalTypeEnv } from "./type-check";
import { Value, Type, Literal } from "./ast";
import { parse } from "./parser";
import { NUM, STRING, BOOL, NONE, LIST, CLASS, CALLABLE, PyValue ,stringify, PyString} from "./utils";
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
      let mem = new Uint32Array(this.importObject.js.memory.buffer)
      const view = new Int32Array(mem);
      let list_length = view[(arg / 4) + 1];
      let list_bound = view[(arg / 4) + 2];
      var base_str = ""
      var index = 0
      let p_list = []
  
      while(index < list_length)
      {
        switch(typ) {
          case ListContentTag.Num:
            base_str = stringify( PyValue(LIST(NUM), arg, mem))
            p_list.push(stringify(PyValue(NUM, view[(arg / 4) + 3 + index], mem)) )
            break
          case ListContentTag.Bool:
            base_str = stringify( PyValue(LIST(BOOL), arg, mem))
            p_list.push(stringify(PyValue(BOOL, view[(arg / 4) + 3 + index], mem)) )
            break
          //Realistically can never happen
          case ListContentTag.None:
            base_str = stringify( PyValue(LIST(NONE), arg, mem))
            p_list.push(stringify(PyValue(NONE, view[(arg / 4) + 3 + index], mem)) )
            break
          //We didn't actually store the name of the class anywhere
          //This will display as "<list<class> object at N>"
          case ListContentTag.Str:
            base_str = stringify( PyValue(LIST(STRING), arg, mem))
            p_list.push(stringify(PyValue(STRING, view[(arg / 4) + 3 + index], mem)) )
            break
          case ListContentTag.Class:
            base_str = stringify( PyValue(LIST(CLASS("class")), arg, mem))
            p_list.push(stringify(PyValue(CLASS("CLASS"), view[(arg / 4) + 3 + index], mem)) )
            break
          //Doesn't display type of inner list
          //This will display as "<list<list> object at N>"
          case ListContentTag.List:
            base_str = stringify( PyValue(LIST(LIST(null)), arg, mem))
            p_list.push(stringify(PyValue(LIST(LIST(null)), view[(arg / 4) + 3 + index], mem) )) 
            break
          //TODO: Placeholder for Dict
          case ListContentTag.Dict:
            base_str = stringify( PyValue(LIST(LIST(null)), arg, mem))
            p_list.push(stringify(PyValue(CLASS("Dict"), view[(arg / 4) + 3 + index], mem)) )
            break
          //TODO: Placeholder for Callable
          case ListContentTag.Callable:
            base_str = stringify( PyValue(LIST(NUM), arg, mem))
            p_list.push(stringify(PyValue(CLASS("Callable"), view[(arg / 4) + 3 + index], mem)) )
            break
            
        }
        index += 1
      }

      this.importObject.imports.print(
        PyString( `${base_str} [ ${p_list.join(", ")} ]`, arg)
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
