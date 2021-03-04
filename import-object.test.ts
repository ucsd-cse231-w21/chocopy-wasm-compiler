// -*- mode: typescript; typescript-indent-level: 2; -*-

import { Type } from "../ast";
import { STR, NUM, BOOL, NONE } from "../utils";
import * as err from "../error";

function stringify(typ: Type, arg: any): string {
  switch (typ.tag) {
    case "number":
      return (arg as number).toString();
    case "bool":
      return (arg as boolean) ? "True" : "False";
    case "none":
      return "None";
    case "str":
      console.log(`arg: ${arg}`)
      return arg;
    case "class":
      return typ.name;
    default:
      err.internalError();
  }
}

function print(typ: Type, arg: any): any {
  console.log(`type: ${typ.tag}, arg: ${arg}`);
  importObject.output += stringify(typ, arg);
  importObject.output += "\n";
  return arg;
}



export const importObject = {
  imports: {
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
    print: (arg: any) => print(NUM, arg),
    print_num: (arg: number) => print(NUM, arg),
    print_bool: (arg: number) => print(BOOL, arg),
    print_none: (arg: number) => print(NONE, arg),
    print_txt: (arg: string) => print(STR, arg),
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
  },

  output: "",
};
