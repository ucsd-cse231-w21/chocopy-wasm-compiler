import { isSameType, typeToString } from "../ast";
import { assert } from "../tests/utils.test";
import {Type} from "../ast";
import { BasicREPL } from "../repl";
import { NUM, BOOL, NONE, unhandledTag } from "../utils";
import { readFileSync } from 'fs';
import { otherModule } from "./builtins";


/*
console.log(isSameType({tag: "number"}, {tag: "none"}));
console.log(typeToString(
                         {tag: "callable", 
                          args: [ {tag: "number"} , 
                                  {tag: "bool"} ,
                                  {tag: "callable", args: [{tag: "number"}], ret: {tag: "none"}}
                                ] , 
                          ret: {tag: "bool"}}));
*/

function stringify(typ: Type, arg: any): string {
  switch (typ.tag) {
    case "number":
      return (arg as number).toString();
    case "bool":
      return (arg as boolean) ? "True" : "False";
    case "none":
      return "None";
    case "class":
      return typ.name;
    default:
      unhandledTag(typ);
  }
}

function print(typ: Type, arg: number): any {
  console.log("Logging from WASM: ", arg);
  const elt = document.createElement("pre");
  //document.getElementById("output").appendChild(elt);
  //elt.innerText = stringify(typ, arg);
  return arg;
}

var importObject : any = {
  imports: {
    print_num: (arg: number) => print(NUM, arg),
    print_bool: (arg: number) => print(BOOL, arg),
    print_none: (arg: number) => print(NONE, arg),
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
  }
};

/*
//add sample builtin module
importObject["otherModule"] = {};

for(let [name, info] of otherModule.functions.entries()){
  importObject["otherModule"][name] = info.func;
}
*/

const file = readFileSync('./builtins/testFile.txt', 'utf-8');
const repl = new BasicREPL(importObject);
repl.tc(file);
console.log("==============TC PASSED============");
repl.run(file);