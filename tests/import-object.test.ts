import { Type, Value } from "../ast";
import { NUM, STRING, BOOL, NONE, unhandledTag, stringify } from "../utils";
import { MemoryManager } from "../alloc";
import { nTagBits } from "../compiler";

function print(val: Value) {
  importObject.output += stringify(val);
  importObject.output += "\n";
}

const memory = new WebAssembly.Memory({ initial: 2000, maximum: 2000 });
var memory_js = { memory: memory };

export const importObject = {
  imports: {
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
    print: print,
  },
  js: memory_js,
  output: "",
  memoryManager: undefined as undefined | MemoryManager,
};
