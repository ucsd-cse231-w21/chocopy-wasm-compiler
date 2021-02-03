// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import { checkServerIdentity } from 'tls';
import wabt from 'wabt';
import { wasm } from 'webpack';
import * as compiler from './compiler';
import {parse} from './parser';
import {emptyLocalTypeEnv, GlobalTypeEnv, tc, tcStmt} from  './type-check';
import { Type, NONE, BOOL, NUM, CLASS } from './ast';

export type Config = {
  importObject: any;
  env: compiler.GlobalEnv,
  typeEnv: GlobalTypeEnv
}

const defaultGlobalFunctions = new Map();
defaultGlobalFunctions.set("abs", [[NUM], NUM]);
defaultGlobalFunctions.set("max", [[NUM, NUM], NUM]);
defaultGlobalFunctions.set("min", [[NUM, NUM], NUM]);
defaultGlobalFunctions.set("pow", [[NUM, NUM], NUM]);
defaultGlobalFunctions.set("print", [[CLASS("object")], NUM]);
defaultGlobalFunctions.set("print_num", [[NUM], NUM]);
defaultGlobalFunctions.set("print_bool", [[BOOL], BOOL]);

export const defaultTypeEnv = {
  globals: new Map(),
  functions: defaultGlobalFunctions
}

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

export async function runWat(source : string, importObject : any) : Promise<any> {
  const wabtInterface = await wabt();
  const myModule = wabtInterface.parseWat("test.wat", source);
  var asBinary = myModule.toBinary({});
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, importObject);
  const result = (wasmModule.instance.exports.exported_func as any)();
  return result;
}

export async function run(source : string, config: Config) : Promise<[any, compiler.GlobalEnv, GlobalTypeEnv]> {
  const parsed = parse(source);
  const [tprogram, tenv] = tc(config.typeEnv, parsed);
  const retTyp = tprogram.a;
  var returnType = "";
  var returnExpr = "";
  const lastExpr = parsed.stmts[parsed.stmts.length - 1]
  const lastExprTyp = tcStmt(tenv, emptyLocalTypeEnv(), lastExpr);
  console.log("LASTEXPR", lastExpr);
  if(lastExprTyp !== NONE) {
    returnType = "(result i32)";
    returnExpr = "(local.get $$last)"
  } 
  const compiled = compiler.compile(tprogram, config.env);
  const importObject = config.importObject;
  if(!importObject.js) {
    const memory = new WebAssembly.Memory({initial:10, maximum:100});
    importObject.js = { memory: memory };
  }
  const wasmSource = `(module
    (import "js" "memory" (memory 1))
    (func $print (import "imports" "print") (param i32) (result i32))
    (func $print_num (import "imports" "print_num") (param i32) (result i32))
    (func $print_bool (import "imports" "print_bool") (param i32) (result i32))
    (func $abs (import "imports" "abs") (param i32) (result i32))
    (func $min (import "imports" "min") (param i32) (param i32) (result i32))
    (func $max (import "imports" "max") (param i32) (param i32) (result i32))
    (func $pow (import "imports" "pow") (param i32) (param i32) (result i32))
    ${compiled.functions}
    (func (export "exported_func") ${returnType}
      ${compiled.mainSource}
      ${returnExpr}
    )
  )`;
  console.log(wasmSource);
  var result = await runWat(wasmSource, importObject);
  if (retTyp === BOOL) {
    result = Boolean(result);
  }
  return [result, compiled.newEnv, defaultTypeEnv]; // TODO update
}
