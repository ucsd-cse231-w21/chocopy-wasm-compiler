// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import { checkServerIdentity } from "tls";
import wabt from "wabt";
import { wasm } from "webpack";
import * as compiler from "./compiler";
import { parse } from "./parser";
import { GlobalTypeEnv, tc } from "./type-check";
import { Value, Type, Location } from "./ast";
import { PyValue, NONE } from "./utils";
import { ea } from "./ea";

export type Config = {
  importObject: any;
  env: compiler.GlobalEnv;
  typeEnv: GlobalTypeEnv;
  functions: string; // prelude functions
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
): Promise<[Value, compiler.GlobalEnv, GlobalTypeEnv, string]> {
  const parsed = parse(source);
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
  let globalsBefore = (config.env.globals as Map<string, number>).size;
  const eaProgram = ea(tprogram);
  const compiled = compiler.compile(eaProgram, config.env);
  let globalsAfter = compiled.newEnv.globals.size;

  const importObject = config.importObject;
  if (!importObject.js) {
    const memory = new WebAssembly.Memory({ initial: 2000, maximum: 2000 });
    importObject.js = { memory: memory };
  }

  const view = new Int32Array(importObject.js.memory.buffer);
  let offsetBefore = view[0];
  console.log("before updating: ", offsetBefore);
  view[0] = offsetBefore + (globalsAfter - globalsBefore) * 4;
  console.log("after updating: ", view[0]);

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
  def range(s : int)->Range:
    self:range = None
    self = range()
    self.cur = 0
    self.stop = s
    self.step = 1
    return self
*/
  const wasmSource = `(module
    (import "js" "memory" (memory 1))
    (func $print_num (import "imports" "print_num") (param i32) (result i32))
    (func $print_str (import "imports" "print_str") (param i32) (result i32))
    (func $print_bool (import "imports" "print_bool") (param i32) (result i32))
    (func $print_none (import "imports" "print_none") (param i32) (result i32))
    (func $abs (import "imports" "abs") (param i32) (result i32))
    (func $min (import "imports" "min") (param i32) (param i32) (result i32))
    (func $max (import "imports" "max") (param i32) (param i32) (result i32))
    (func $pow (import "imports" "pow") (param i32) (param i32) (result i32))
    (func $range (param $s i32) (result i32)
      (local $self i32)
      (local $$last i32)
      (i32.const 0)
      (local.set $self)
      (i32.load (i32.const 0))
      (i32.add (i32.const 0))
      (i32.const 0)
      (i32.store)
      (i32.load (i32.const 0))
      (i32.add (i32.const 4))
      (i32.const 0)
      (i32.store)
      (i32.load (i32.const 0))
      (i32.add (i32.const 8))
      (i32.const 1)
      (i32.store)
      (i32.load (i32.const 0))
      (i32.load (i32.const 0))
      (i32.const 0)
      (i32.load (i32.const 0))
      (i32.add (i32.const 12))
      (i32.store)
      (call $Range$__init__)
      (drop)
      (local.set $self)
      (local.get $self)
      (i32.add (i32.const 0))
      (i32.const 0)
      (i32.store)
      (local.get $self)
      (i32.add (i32.const 4))
      (local.get $s)
      (i32.store)
      (local.get $self)
      (i32.add (i32.const 8))
      (i32.const 1)
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
  compiled.newEnv.offset = view[0] / 4;

  return [PyValue(progTyp, result), compiled.newEnv, tenv, compiled.functions];
}
