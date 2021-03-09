import { Type } from "../ast";
import { stringify } from "../utils";
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
  },

  output: "",
};
