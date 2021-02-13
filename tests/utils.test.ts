import "mocha";
import { expect } from "chai";
import { BasicREPL } from "../repl";
import { Value } from "../ast";
import { importObject } from "./import-object.test";
import { fail } from "assert";



// Clear the output before every test
beforeEach(function () {
  importObject.output = "";
});

// suppress console logging so output of mocha is clear
before(function () {
  console.log = function () {};
});

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

// export function runWasm(name: string, source: string, expected: any) {
//   it(name, async () => {
//     const result = await runWat(source, {});
//     expect(result).to.equal(expected);
//   });
// }

export function assertTC(name: string, source: string, result: any) {
  it(name, async () => {
      const repl = new BasicREPL(importObject);
      const typ = await repl.tc(source);
      expect(typ).to.deep.eq(result);
  });
}

export function assertTCFail(name: string, source: string) {
  it(name, async () => {
      const repl = new BasicREPL(importObject);
      try {
      const typ = await repl.tc(source);
      fail("Expected an exception, got a type " + typ);
      } catch (e) {
      expect(e).to.instanceof(Error);
      }
  });
}

