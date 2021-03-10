// -*- mode: typescript; typescript-indent-level: 2; -*-

import { PyInt, PyBool, PyNone, PyStr, NUM, CLASS } from "../utils";
import { assert, asserts, assertPrint, assertTCFail, assertTC, assertFail } from "./utils.test";

const initStrs = `t0: str = "Hello!"\nt1: str = "World"\nnumbers: str = "1 2 3 4 5 6 7 8"`;

describe("String typechecking", () => {
  assertFail("str-int-0", `"str" + 3`);
  assertFail("str-int-1", `3 + "str"`);
  assertFail("str-int-2", `"str" / 3`);
  assertFail("str-int-3", `3 / "str"`);
  assertFail("str-int-4", `3 % "str"`);
  assertFail("str-int-5", `"str" % 3`);
});
