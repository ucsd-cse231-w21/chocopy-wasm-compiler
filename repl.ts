import {run, Config, defaultTypeEnv} from "./runner";
import {emptyEnv, GlobalEnv} from "./compiler";
import { emptyLocalTypeEnv, GlobalTypeEnv } from "./type-check";

interface REPL {
  run(source : string) : Promise<any>;
}

export class BasicREPL {
  currentEnv: GlobalEnv
  currentTypeEnv: GlobalTypeEnv
  importObject: any
  memory: any
  constructor(importObject : any) {
    this.importObject = importObject;
    if(!importObject.js) {
      const memory = new WebAssembly.Memory({initial:10, maximum:20});
      this.importObject.js = { memory: memory };
    }
    this.currentEnv = {
      globals: new Map(),
      locals: new Set(),
      offset: 0
    };
    this.currentTypeEnv = defaultTypeEnv
  }
  async run(source : string) : Promise<any> {
    // this.importObject.updateNameMap(this.currentEnv); // is this the right place for updating the object's env?
    const config : Config = {importObject: this.importObject, env: this.currentEnv, typeEnv: this.currentTypeEnv};
    const [result, newEnv, newTypeEnv] = await run(source, config);
    this.currentEnv = newEnv;
    this.currentTypeEnv = newTypeEnv;
    return result;
  }
}