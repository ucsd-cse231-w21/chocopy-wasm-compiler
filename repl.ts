import { run } from "./runner";
import { tc } from "./type-check";
import { Value, Type, typeToString } from "./ast";
import { parse } from "./parser";
import { builtinModules } from "module";
import { attachPresenter, BuiltInModule, gatherPresenters, otherModule } from "./builtins/builtins";
import { type } from "cypress/types/jquery";
import { ModulePresenter, OrganizedModule } from "./types";
import { last, thru } from "cypress/types/lodash";
import { NONE } from "./utils";
import fs from 'fs';


interface REPL {
  run(source: string): Promise<any>;
}

export type Config = {
  builtIns: Map<string, BuiltInModule>,
  builtInPresenters: Map<string, ModulePresenter>,
  funcs: any
}

export class BasicREPL {
  
  private config: Config;
  private curModule: OrganizedModule;

  constructor(config: Config) {
    this.config = config;
    this.curModule = undefined;
  }
  
  async run(source: string): Promise<Value> {
    const parsed = parse(source);
    const organized = tc(this.curModule === undefined ? 
                          undefined :  
                          this.curModule.presented, this.config.builtInPresenters, parsed);

    return undefined;
  }

  async tc(source: string): Promise<Type> {
    const parsed = parse(source);
    const organized = tc(this.curModule === undefined ? 
                          undefined :  
                          this.curModule.presented, this.config.builtInPresenters, parsed);
    const lastStmt = organized.topLevelStmts[organized.topLevelStmts.length - 1];

    //console.log(` LAST STMT , is expr? ${lastStmt.tag} ${JSON.stringify(lastStmt)}`);
    if(lastStmt.tag === "expr"){
      return lastStmt.a;
    }
    return NONE;
  }


}

async function main(){
  const builtins = new Map<string, BuiltInModule>();

  attachPresenter(otherModule);

  builtins.set(otherModule.name, otherModule);

  const repl = new BasicREPL({builtIns: builtins, builtInPresenters: gatherPresenters(builtins), funcs: undefined});

  const input = fs.readFileSync("./sampleprogs/sample6.txt","ascii");
  let v = await repl.tc(input);
  
  console.log("last type: "+typeToString(v));

  /*
  var stdin = process.openStdin();
  stdin.addListener("data", async function(d) {
      // note:  d is an object, and when converted to a string it will
      // end with a linefeed.  so we (rather crudely) account for that  
      // with toString() and then substring() 
      const code = d.toString().trim();
      console.log("you entered: [" + code + "]");
      let v = await repl.run(code);
      console.log("       ===> result "+v.tag);
  });
  */
 
}

main();