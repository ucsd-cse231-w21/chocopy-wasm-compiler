import { Type } from "../ast";
import { stringify } from "../utils";
import { Value } from "../ast";

function print(val: Value) {
  importObject.output += stringify(val);
  importObject.output += "\n";
}

const memory = new WebAssembly.Memory({ initial: 2000, maximum: 2000 });
const view = new Int32Array(memory.buffer);
view[0] = 4;
var memory_js = { memory: memory };

export const importObject = {
  imports: {
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
    print: print,
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
  },
  js: memory_js,
  output: "",
};
