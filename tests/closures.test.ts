import * as mocha from "mocha";
import { expect } from "chai";
import { parser } from "lezer-python";
import { assert, asserts, assertPrint, assertTCFail, assertTC, assertFail } from "./utils.test";
import { PyInt, PyBool, PyNone, NUM, BOOL, CLASS, NONE } from "../utils";
import { Type, Value, Program, BinOp } from "../ast";
import { GlobalEnv, compile } from "../compiler";
import { BasicREPL } from "../repl";

describe("Closures", () => {
  it("Trivial nested function without escape", () => {
    let src =  
    `
    def f(x: int) -> int:
      def inc() -> int:
      return x + 1
      return inc()
    f(5)
    `
    assert("Trivial nested function without escape", src, PyInt(6));
  });


  it("Trivial `nonlocal` usage", () => {
    let src = 
    `
    def f(x : int) -> int:
    def g(y : int) -> int:
      return x + h(y) 
    def h(z : int) -> int:
      nonlocal x
      x = z
      return x + 1
    return g(10) + g(7)
    f(6)
    `
    assert("Trivial `nonlocal` usage", src, PyInt(35));
  });
});



