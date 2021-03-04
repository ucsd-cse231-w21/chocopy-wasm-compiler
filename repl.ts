import { run, Config } from "./runner";
import { GlobalEnv } from "./compiler";
import { tc, defaultTypeEnv, GlobalTypeEnv } from "./type-check";
import { Value, Type } from "./ast";
import { parse } from "./parser";
import { builtinModules } from "module";
import { BuiltInModule , descToGlobalEnv, otherModule} from "./builtins/builtins";

interface REPL {
  run(source: string): Promise<any>;
}

export class BasicREPL {
  currentEnv: GlobalEnv;
  currentTypeEnv: GlobalTypeEnv;
  functions: string;
  importObject: any;
  memory: any;
  builtIns: Map<string, BuiltInModule>;


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
      imports: new Set(["otherModule"]),
      offset: 1
    };
    
    this.builtIns = new Map([["otherModule", otherModule]]);
    this.currentTypeEnv = defaultTypeEnv;
    this.functions = "";
  }
  async run(source: string): Promise<Value> {

    //convert BuitlInModule to GlobalTypeEnv
    const builtInMap : Map<string, GlobalTypeEnv> = new Map();
    for(let [name, info] of this.builtIns.entries()){
      builtInMap.set(name, descToGlobalEnv(info));
    }

    const config: Config = {
      importObject: this.importObject,
      env: this.currentEnv,
      typeEnv: this.currentTypeEnv,
      functions: this.functions,
      builtIns: builtInMap
    };


    const [result, newEnv, newTypeEnv, newFunctions] = await run(source, config);
    this.currentEnv = newEnv;
    this.currentTypeEnv = newTypeEnv;
    this.functions += newFunctions;
    return result;
  }
  async tc(source: string): Promise<Type> {
    //convert BuitlInModule to GlobalTypeEnv
    const builtInMap : Map<string, GlobalTypeEnv> = new Map();
    for(let [name, info] of this.builtIns.entries()){
      builtInMap.set(name, descToGlobalEnv(info));
    }

    const config: Config = {
      importObject: this.importObject,
      env: this.currentEnv,
      typeEnv: this.currentTypeEnv,
      functions: this.functions,
      builtIns: builtInMap
    };
    const parsed = parse(source);
    const [result, _] = await tc(this.currentTypeEnv, parsed, builtInMap);
    return result.a;
  }
}
