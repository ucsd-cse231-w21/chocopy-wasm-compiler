import "mocha";
import { expect } from "chai";
import { Config, defaultTypeEnv, run, runWat } from "../runner";
import { emptyEnv } from "../compiler";
import { BasicREPL } from "../repl";
import { Type, NUM, BOOL, NONE, Value } from "../ast";
import { PyInt, PyBool, PyNone, PyObj } from "../utils";
import { parse } from "../parser";
import { tc, tcStmt, tcExpr, TypeCheckError } from "../type-check";
import { fail } from "assert";



// Clear the output before every test
beforeEach(function () {
  importObject.output = "";
});

// suppress console logging so output of mocha is clear
before(function () {
  console.log = function () {};
});


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
  }
}

function print(typ: Type, arg: any): any {
  importObject.output += stringify(typ, arg);
  importObject.output += "\n";
  return arg;
}

const importObject = {
  imports: {
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
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

export function assert(name: string, source: string, expected: Value) {
  it(name, async () => {
    const repl = new BasicREPL(importObject);
    const result = await repl.run(source);
    expect(result).to.deep.eq(expected);
  });
}

export function asserts(name: string, pairs: Array<[string, Value]>) {
  const repl = new BasicREPL(importObject);

  it(name, async () => {
    for (let i = 0; i < pairs.length; i++) {
      const result = await repl.run(pairs[i][0]);
      expect(result).to.deep.eq(pairs[i][1]);
    }
  });
}

export function assertFail(name: string, source: string) {
  it(name, async () => {
    try {
      const repl = new BasicREPL(importObject);
      const result = await repl.run(source);
      fail("Expected an exception, got a type " + JSON.stringify(result));
    } catch (err) {
      expect(err).to.be.an("Error");
    }
  });
}

export function assertPrint(name: string, source: string, expected: Array<string>) {
  it(name, async () => {
    const repl = new BasicREPL(importObject);
    const result = await repl.run(source);
    expect(importObject.output.trim().split("\n")).to.deep.eq(expected);
  });
}

export function runWasm(name: string, source: string, expected: any) {
  it(name, async () => {
    const result = await runWat(source, {});
    expect(result).to.equal(expected);
  });
}

export function assertTC(name: string, source: string, result: any) {
  it(name, async () => {
      const ast = parse(source);
      const [tast, _] = tc(defaultTypeEnv, ast);
      const typ = tast.a;
      expect(typ).to.deep.eq(result);
  });
}

export function assertTCFail(name: string, source: string) {
  it(name, async () => {
      const ast = parse(source);
      try {
      const [typ, _] = tc(defaultTypeEnv, ast);
      fail("Expected an exception, got a type " + typ);
      } catch (e) {
      expect(e).to.instanceof(TypeCheckError);
      }
  });
}

