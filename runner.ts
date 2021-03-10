// -*- mode: typescript; typescript-indent-level: 2; -*-

// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import { Value }  from './ast';
import { i64ToValue } from './common';
import wabt from 'wabt';
import * as compiler from './compiler';
import { parse } from './parser';
import { GlobalEnv } from './env';
import { prettifyWasmSource } from './linter';
import { NONE_VAL, dumpMem } from './common';

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

export async function run(source : string, config: any) : Promise<[any, GlobalEnv, string]> {
  const wabtInterface = await wabt();
  const parsed = parse(source);
  var returnType = "";
  var returnExpr = "";
  const lastExpr = parsed[parsed.length - 1]
  
  if(lastExpr.tag === "expr") {
    returnType = "(result i64)";
    returnExpr = "(local.get $$last)";
  } else {
    returnType = "(result i64)";
    returnExpr = `(i64.const ${NONE_VAL})`;
  }

  const compiled = compiler.compile(source, config.env);
  const importObject = config.importObject;

  if(!importObject.js) {
    const memory = new WebAssembly.Memory({initial:1024, maximum:1024});
    const table = new WebAssembly.Table({element: "anyfunc", initial:10});
    importObject.js = { memory: memory, table: table };
  }

  importObject.updateTableMap(compiled.newEnv);

  var memUint8: Uint8Array = new Uint8Array(importObject.js.memory.buffer);
  var memUint64 = new BigUint64Array(importObject.js.memory.buffer);
  
  compiled.newEnv.globalStrs.forEach((off, str) => {
    const strLen: number = str.length;
    var iter: number = 0;
    while (iter < strLen) {
      memUint8[iter + off] = str.charCodeAt(iter);
      iter += 1;
    }
    memUint8[iter+off] = 0;
  });

  dumpMem(memUint8);

  const wasmSource = `(module
    (func $print$other (import "imports" "print_other") (param i64) (result i64))
    (func $print$obj (import "imports" "print_obj") (param i64) (param i64) (result i64))
    (func $runtime_check$assert_non_none (import "imports" "assert_non_none") (param i64) (result i64))

    (func $str$len (import "imports" "str_len") (param i64) (result i64))
    (func $str$concat (import "imports" "str_concat") (param i64) (param i64) (result i64))
    (func $str$slice (import "imports" "str_slice") (param i64) (param i64) (param i64) (param i64) (param i64) (result i64))
    (func $str$mult (import "imports" "str_mult") (param i64) (param i64) (result i64))
    (func $str$eq (import "imports" "str_eq") (param i64) (param i64) (result i64))
    (func $str$neq (import "imports" "str_neq") (param i64) (param i64) (result i64))
    (func $str$le (import "imports" "str_le") (param i64) (param i64) (result i64))
    (func $str$lt (import "imports" "str_lt") (param i64) (param i64) (result i64))
    (func $str$ge (import "imports" "str_ge") (param i64) (param i64) (result i64))
    (func $str$gt (import "imports" "str_gt") (param i64) (param i64) (result i64))
    (func $str$fromInt (import "imports" "str_fromInt") (param i64) (result i64))
    (func $str$upper (import "imports" "str_upper") (param i64) (result i64))
    (func $str$lower (import "imports" "str_lower") (param i64) (result i64))

    (import "js" "memory" (memory 1))
    ;; (import "js" "table" (table 1 funcref))
    (func (export "exported_func") ${returnType}      
      ${compiled.wasmSource}
      ${returnExpr}
    )
    ${compiled.funcs}
  )`;

  console.log("Generated WASM");
  console.log(prettifyWasmSource(wasmSource));

  try {
    const myModule = wabtInterface.parseWat("test.wat", wasmSource);
    var asBinary = myModule.toBinary({});
    var wasmModule = await WebAssembly.instantiate(asBinary.buffer, importObject);
    const resultAny = (wasmModule.instance.exports.exported_func as any)();
    var result: Value = i64ToValue(resultAny, importObject.tableOffset);
  } catch (error) {
    compiler.abort();
    console.info("Wabt compilation/runtime error recorded");
    throw error;
  }

  // Update the heap pointer after execution

  // const heapPtrBuffer = importObject.js.memory.buffer.slice(0, 8);
  // const heapPtrDV = new DataView(heapPtrBuffer, 0, 8);
  // const heapPtr = heapPtrDV.getBigUint64(0, true);
  // compiled.newEnv.offset = Number(heapPtr);
  compiled.newEnv.offset = Number(memUint64[0]);

  return [result, compiled.newEnv, wasmSource];
}
