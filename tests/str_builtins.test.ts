// -*- mode: typescript; typescript-indent-level: 2; -*-

import { PyInt, PyBool, PyNone, PyStr, NUM, CLASS } from "../utils";
import { assert, asserts, assertPrint, assertTCFail, assertTC, assertFail } from "./utils.test";

const initStrs = `t0: str = "Hello!"\nt1: str = "World"\nnumbers: str = "1 2 3 4 5 6 7 8"`;

describe("String builtins", () => {
  assert("startswith-test-0", `"abcd".startswith("a")`, PyBool(true));
  assert("startswith-test-1", `"abcd".startswith("ab")`, PyBool(true));
  assert("startswith-test-2", `"abcd".startswith("abc")`, PyBool(true));
  assert("startswith-test-3", `"abcd".startswith("abcd")`, PyBool(true));
  assert("startswith-test-4", `"abcd".startswith("b")`, PyBool(false));
  assert("startswith-test-5", `"abcd".startswith("bc")`, PyBool(false));
  assert("startswith-test-6", `"abcd".startswith("abcde")`, PyBool(false));
  assert("startswith-test-7", `"abcd".startswith("")`, PyBool(true));

  assert("endswith-test-0", `"abcd".endswith("d")`, PyBool(true));
  assert("endswith-test-1", `"abcd".endswith("cd")`, PyBool(true));
  assert("endswith-test-2", `"abcd".endswith("bcd")`, PyBool(true));
  assert("endswith-test-3", `"abcd".endswith("abcd")`, PyBool(true));
  assert("endswith-test-4", `"abcd".endswith("b")`, PyBool(false));
  assert("endswith-test-5", `"abcd".endswith("bc")`, PyBool(false));
  assert("endswith-test-6", `"abcd".endswith("abcde")`, PyBool(false));
  assert("endswith-test-7", `"abcd".endswith("")`, PyBool(true));

  assert("upper-test-0", `"a".upper() == "A"`, PyBool(true));
  assert("upper-test-1", `"ab".upper() == "AB"`, PyBool(true));
  assert("upper-test-2", `"A".upper() == "A"`, PyBool(true));
  assert("upper-test-3", `"AB".upper() == "AB"`, PyBool(true));
  assert("upper-test-4", `"1 ~@".upper() == "1 ~@"`, PyBool(true));

  assert("lower-test-0", `"a".lower() == "a"`, PyBool(true));
  assert("lower-test-1", `"ab".lower() == "ab"`, PyBool(true));
  assert("lower-test-2", `"A".lower() == "a"`, PyBool(true));
  assert("lower-test-3", `"AB".lower() == "ab"`, PyBool(true));
  assert("lower-test-4", `"1 ~@".lower() == "1 ~@"`, PyBool(true));

});
