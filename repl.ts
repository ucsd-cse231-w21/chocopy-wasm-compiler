import { run } from "./runner";
import { GlobalEnv } from "./compiler";
import { tc } from "./type-check";
import { Value, Type } from "./ast";
import { parse } from "./parser";
import { builtinModules } from "module";
import { BuiltInModule } from "./builtins/builtins";
import { type } from "cypress/types/jquery";

interface REPL {
  run(source: string): Promise<any>;
}

export type Config = {
  builtIns: Map<string, BuiltInModule>,
  funcs: any
}

export class BasicREPL {
  
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }
  
  async run(source: string): Promise<Value> {
    const parsed = parse(source);
    const builtPresenters = new Map();
    const organized = tc(parsed, );
  }

  async tc(source: string): Promise<Type> {
    
  }
}
