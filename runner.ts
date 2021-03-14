// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import wabt from 'wabt';
import * as compiler from './compiler';
import { EnvManager } from './env';
import { MemoryManager } from './memory';

// NOTE(joe): This is a hack to get the CLI Repl to run. WABT registers a global
// uncaught exn handler, and this is not allowed when running the REPL
// (https://nodejs.org/api/repl.html#repl_global_uncaught_exceptions). No reason
// is given for this in the docs page, and I haven't spent time on the domain
// module to figure out what's going on here. It doesn't seem critical for WABT
// to have this support, so we patch it away.
if(typeof process !== "undefined") {
  const oldProcessOn = process.on;
  process.on = (...args : any) : any => {
    if(args[0] === "uncaughtException") { return; }
    else { return oldProcessOn.apply(process, args); }
  };
}

// const MEMORY_SIZE = 10;
// const memory  = new WebAssembly.Memory({ initial: MEMORY_SIZE, maximum: MEMORY_SIZE });
const globalMemory: MemoryManager = new MemoryManager();
const envManager: EnvManager = new EnvManager();


export async function run(source : string) : Promise<any> {
  const wabtInterface = await wabt();
  
  const importObject = {
    // js: { mem: memory },
    // imports: {
    //   print: (value: number) => {
    //     console.log("Logging from WASM: ", value);
    //     const elt = document.createElement("pre");
    //     document.getElementById("output").appendChild(elt);
    //     let text = value.toString();
    //     elt.innerText = text;
    //     return value
    //   },
    // },
  };

  const compileResult = compiler.compile(source, importObject, globalMemory, envManager);
  
  // only for debugging
  // (window as any)["importObject"] = importObject;
  // (window as any)["wasmMemory"] = new Int32Array(importObject.js.mem.buffer);
  (window as any)["wasmMemory"] = new Int32Array(globalMemory.memory.buffer);

  const wasmSource = compileResult.wasmSource;

  const myModule = wabtInterface.parseWat("test.wat", wasmSource);
  var asBinary = myModule.toBinary({});
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, importObject);
  const result = (wasmModule.instance.exports.exported_func as any)();
  return result;
}
