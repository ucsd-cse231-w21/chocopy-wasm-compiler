// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import wabt from "wabt";
import * as compiler from "./compiler";
import { parse } from "./parser";
// import { emptyLocalTypeEnv, GlobalTypeEnv, tc, tcStmt } from "./type-check";
// import { Type, Value } from "./ast";
// import { PyValue, NONE, BOOL, NUM, CLASS } from "./utils";
import { GlobalTypeEnv, tc } from "./type-check";
import { Value } from "./ast";
import { PyValue, NONE } from "./utils";
import { importMemoryManager, MemoryManager, TAG_CLASS } from "./alloc";
import { ea } from "./ea";
import { ErrorManager } from "./errorManager";

export type Config = {
  importObject: any;
  env: compiler.GlobalEnv;
  typeEnv: GlobalTypeEnv;
  functions: string; // prelude functions
  errorManager: ErrorManager;
  memoryManager: MemoryManager;
};

// NOTE(joe): This is a hack to get the CLI Repl to run. WABT registers a global
// uncaught exn handler, and this is not allowed when running the REPL
// (https://nodejs.org/api/repl.html#repl_global_uncaught_exceptions). No reason
// is given for this in the docs page, and I haven't spent time on the domain
// module to figure out what's going on here. It doesn't seem critical for WABT
// to have this support, so we patch it away.
if (typeof process !== "undefined") {
  const oldProcessOn = process.on;
  process.on = (...args: any): any => {
    if (args[0] === "uncaughtException") {
      return;
    } else {
      return oldProcessOn.apply(process, args);
    }
  };
}

export async function runWat(source: string, importObject: any): Promise<any> {
  const wabtInterface = await wabt();
  const myModule = wabtInterface.parseWat("test.wat", source);
  var asBinary = myModule.toBinary({});
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, importObject);
  const result = (wasmModule.instance.exports.exported_func as any)();
  return result;
}

export async function run(
  source: string,
  config: Config
): Promise<[Value, compiler.GlobalEnv, GlobalTypeEnv, string, ErrorManager]> {
  config.errorManager.sources.push(source);
  const parsed = parse(source, config);
  console.log(parsed);
  const [tprogram, tenv] = tc(config.typeEnv, parsed);
  console.log(tprogram);
  const progTyp = tprogram.a[0];
  var returnType = "";
  var returnExpr = "";
  // const lastExpr = parsed.stmts[parsed.stmts.length - 1]
  // const lastExprTyp = lastExpr.a;
  // console.log("LASTEXPR", lastExpr);
  if (progTyp !== NONE) {
    returnType = "(result i32)";
    returnExpr = "(local.get $$last)";
  }
  // let globalsBefore = (config.env.globals as Map<string, number>).size;
  const eaProgram = ea(tprogram);
  const compiled = compiler.compile(eaProgram, config.env, config.memoryManager);
  // let globalsAfter = compiled.newEnv.globals.size;

  const importObject = config.importObject;
  if (!importObject.js) {
    const memory = new WebAssembly.Memory({ initial: 2000, maximum: 2000 });
    importObject.js = { memory: memory };
  }
  if (!importObject.memoryManager) {
    // NOTE(alex:mm): DO NOT INSTANTIATE A NEW MEMORY MANAGER
    // MemoryManager potentially carries its own metadata CRUCIAL to GC
    // If you allocate a new MemoryManager and call GC methods on an old MemoryManager,
    //   expect massive breakage
    const memoryManager = config.memoryManager;
    importObject.memoryManager = memoryManager;
    importMemoryManager(importObject, memoryManager);
  }

  const oldView = new Int32Array(importObject.js.memory.buffer);
  // NOTE(alex:mm): view[0] becomes entirely meaningless b/c metadata
  //   is stored on the JS heap via MemoryManager
  //
  // let offsetBefore = view[0];
  // console.log("before updating: ", offsetBefore);
  // view[0] = offsetBefore + (globalsAfter - globalsBefore) * 4;
  // console.log("after updating: ", view[0]);
  console.log("mem view:", oldView);

  const funs = compiled.newEnv.funs;
  let sorted_funs = new Array<string>(funs.size);
  funs.forEach((v, k) => {
    sorted_funs[v[0]] = `$${k}`;
  });

  let funRef = `
(table ${funs.size} funcref)
(elem (i32.const 0) ${sorted_funs.join(" ")})
`;

  /*
  class Range(object):
    cur : int = 0
    stop : int = 0
    step : int = 1
  def range(start : int, end : int, sp : int)->Range:
    self:Range = None
    self = Range()
    self.cur = start
    self.stop = end
    self.step = sp
    return self
*/
  const wasmSource = `(module
    (import "js" "memory" (memory 1))
    (func $print (import "imports" "__internal_print") (param i32) (result i32))
    (func $print_str (import "imports" "__internal_print_str") (param i32) (result i32))
    (func $print_list (import "imports" "__internal_print_list") (param i32) (param i32) (result i32))
    (func $print_num (import "imports" "__internal_print_num") (param i32) (result i32))
    (func $print_bool (import "imports" "__internal_print_bool") (param i32) (result i32))
    (func $print_none (import "imports" "__internal_print_none") (param i32) (result i32))
    (func $abs (import "imports" "abs") (param i32) (result i32))
    (func $min (import "imports" "min") (param i32) (param i32) (result i32))
    (func $max (import "imports" "max") (param i32) (param i32) (result i32))
    (func $pow (import "imports" "pow") (param i32) (param i32) (result i32))
    (func $$big_add (import "imports" "__big_num_add") (param i32) (param i32) (result i32))
    (func $$big_sub (import "imports" "__big_num_sub") (param i32) (param i32) (result i32))
    (func $$big_mul (import "imports" "__big_num_mul") (param i32) (param i32) (result i32))
    (func $$big_div (import "imports" "__big_num_div") (param i32) (param i32) (result i32))
    (func $$big_mod (import "imports" "__big_num_mod") (param i32) (param i32) (result i32))
    (func $$big_eq (import "imports" "__big_num_eq") (param i32) (param i32) (result i32))
    (func $$big_ne (import "imports" "__big_num_ne") (param i32) (param i32) (result i32))
    (func $$big_lt (import "imports" "__big_num_lt") (param i32) (param i32) (result i32))
    (func $$big_lte (import "imports" "__big_num_lte") (param i32) (param i32) (result i32))
    (func $$big_gt (import "imports" "__big_num_gt") (param i32) (param i32) (result i32))
    (func $$big_gte (import "imports" "__big_num_gte") (param i32) (param i32) (result i32))
    (func $$pushStack (import "imports" "__pushStack") (param i32) (param i32) (param i32) (param i32))
    (func $$popStack (import "imports" "__popStack"))
    (func $$check_none_class (import "imports" "__checkNoneClass") (param i32))
    (func $$check_index (import "imports" "__checkIndex") (param i32) (param i32))
    (func $$check_key (import "imports" "__checkKey") (param i32))
    (func $$check_none_lookup (import "imports" "__checkNoneLookup") (param i32))
    (func $$check_division (import "imports" "__checkZeroDivision") (param i32))

    (func $$gcalloc (import "imports" "gcalloc") (param i32) (param i32) (result i32))
    (func $$pushCaller (import "imports" "pushCaller"))
    (func $$popCaller (import "imports" "popCaller"))
    (func $$addTemp (import "imports" "addTemp") (param i32) (result i32))
    (func $$returnTemp (import "imports" "returnTemp") (param i32) (result i32))
    (func $$captureTemps (import "imports" "captureTemps"))
    (func $$releaseTemps (import "imports" "releaseTemps"))
    (func $$pushFrame (import "imports" "pushFrame"))
    (func $$addLocal (import "imports" "addLocal") (param i32) (param i32))
    (func $$removeLocal (import "imports" "removeLocal") (param i32))
    (func $$releaseLocals (import "imports" "releaseLocals"))
    (func $$forceCollect (import "imports" "forceCollect"))

    (func $range (param $start i32) (param $end i32) (param $sp i32) (result i32)
      (local $self i32)
      (local $$last i32)
      (i32.const ${TAG_CLASS})
      (i32.const 96)
      (call $$gcalloc)
      (local.set $self)
      (local.get $self)
      (i32.const 0)
      (i32.store)
      (local.get $self)
      (i32.add (i32.const 4))
      (i32.const 0)
      (i32.store)
      (local.get $self)
      (i32.add (i32.const 8))
      (i32.const 1)
      (i32.store)
      (local.get $self)
      (call $Range$__init__)
      (drop)
      (local.get $self)
      (local.get $self)
      (i32.add (i32.const 0))
      (local.get $start)
      (i32.store)
      (local.get $self)
      (i32.add (i32.const 4))
      (local.get $end)
      (i32.store)
      (local.get $self)
      (i32.add (i32.const 8))
      (local.get $sp)
      (i32.store)

      (local.get $self)
      return (i32.const 0)
    (return))

    (func $Range$__init__ (param $self i32) (result i32)
      (local $$last i32)
      (i32.const 0)
    (return))
    (type $callType0 (func (result i32)))
    (type $callType1 (func (param i32) (result i32)))
    (type $callType2 (func (param i32) (param i32) (result i32)))
    (type $callType3 (func (param i32) (param i32) (param i32) (result i32)))
    (type $callType4 (func (param i32) (param i32) (param i32) (param i32) (result i32)))
    (type $callType5 (func (param i32) (param i32) (param i32) (param i32) (param i32) (result i32)))
    ${funRef}
    ${config.functions}
    ${compiled.functions}
    (func (export "exported_func") ${returnType}
      ${compiled.mainSource}
      ${returnExpr}
    )
  )`;
  console.log(wasmSource);
  const result = await runWat(wasmSource, importObject);
  const newView = new Int32Array(importObject.js.memory.buffer);

  console.log("About to return", progTyp, result);
  return [
    PyValue(progTyp, result, newView),
    compiled.newEnv,
    tenv,
    compiled.functions,
    config.errorManager,
  ];
}
