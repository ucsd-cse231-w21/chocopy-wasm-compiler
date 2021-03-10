import { genProgram } from "./gen";
import { PythonShell } from "python-shell";
import { runPython, logFailure, Error } from "./fuzzer_util";
import { Value, Type } from "../ast";
import { run } from "../runner";
import { NUM, BOOL, NONE, unhandledTag } from "../utils";
import { BasicREPL } from "../repl";

function stringify(typ: Type, arg: any): string {
  switch (typ.tag) {
    case "number":
      return (arg as number).toString();
    case "bool":
      return (arg as boolean) ? "True" : "False";
    case "none":
      return "None";
    case "class":
      return typ.name;
    default:
      unhandledTag(typ);
  }
}

function print(typ: Type, arg: any): any {
  importObject.output += stringify(typ, arg);
  importObject.output += "\n";
  return arg;
}

let importObject = {
  imports: {
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
    print: (arg: any) => print(NUM, arg),
    print_num: (arg: number) => print(NUM, arg),
    print_bool: (arg: number) => print(BOOL, arg),
    print_none: (arg: number) => print(NONE, arg),
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
  },

  output: "",
};

while (true) {
  let program = genProgram();
  let pyProgram = program.to_python;
  let pyValue = runPython(pyProgram);
  importObject.output = "";

  let failed = false;
  let compilerValue: Value | Error = { tag: "error" };
  let compilerPromise;
  try {
    compilerPromise = new BasicREPL(importObject).run(program.to_repl);
  } catch (e) {
    if (pyValue.tag != "error") {
      failed = true;
    }
  }

  compilerPromise.then((e) => {
    compilerValue = e;
  });
  if (compilerValue != pyValue) {
    failed = true;
  }

  if (failed) {
    logFailure(program.to_repl, compilerValue, pyValue);
  }
}
