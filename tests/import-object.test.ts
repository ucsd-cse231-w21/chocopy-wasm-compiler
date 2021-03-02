import { Type } from "../ast";
import { stringify } from "../utils";
import { nTagBits } from "../compiler";
import { Value } from "../ast";

function print(val: Value) {
  importObject.output += stringify(val);
  importObject.output += "\n";
}

export const importObject = {
  imports: {
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
    print: print,
    //print: (arg: any) => print(NUM, arg),
    //print_num: (arg: number) => print(NUM, arg),
    //print_bool: (arg: number) => print(BOOL, arg),
    //print_none: (arg: number) => print(NONE, arg),
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
  },

  output: "",
};
