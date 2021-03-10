// -*- mode: typescript; typescript-indent-level: 2; -*-

import { PyInt, PyBool, PyNone, PyStr, NUM, CLASS } from "../utils";
import { assert, asserts, assertPrint, assertTCFail, assertTC, assertFail } from "./utils.test";

const initStrs = `t0: str = "Hello!"\nt1: str = "World"\nnumbers: str = "1 2 3 4 5 6 7 8"`;

describe("String tests", () => {
  assertPrint("escape-newline", `print("\\n")`, [``,``]);
  assertPrint("escape-tab", `print("\\t")`, [`\t`]);
  assertPrint("escape-escape", `print("\\\\")`, [`\\`]);
  assertPrint("escape-quote", `print("\\"")`, [`"`]);

  assertPrint("str-len-newline", `print(len("\\n"))`, [`1`]);
  assertPrint("str-len-tab", `print(len("\\t"))`, [`1`]);
  assertPrint("str-len-quote", `print(len("\\""))`, [`1`]);
  assertPrint("str-len-escape", `print(len("\\\\"))`, [`1`]);

  assertPrint("str-print-literal-0", `print("test_string")`, ["test_string"]);
  assertPrint("str-print-literal-1", `print("1234567890")`, ["1234567890"]);
  assertPrint("str-print-literal-2", `print("a")`, ["a"]);
  
  assert("str-len-0", `len("12345678")`, PyInt(8));
  assert("str-len-0", `a:str = "12345678"\nlen(a)`, PyInt(8));
  assert("str-len-1", `${initStrs}\nlen(t0)`, PyInt(6));

  assert("str-comparison-equality-true", `"ab" == "ab"`, PyBool(true));
  assert("str-comparison-inequality-true", `"ab" != "bb"`, PyBool(true));
  assert("str-comparison-equality-false", `"ab" == "bb"`, PyBool(false));
  assert("str-comparison-inequality-false", `"aasdf" != "aasdf"`, PyBool(false));
  
  assert("str-le-true", `"ab" <= "ab"`, PyBool(true));
  assert("str-lt-true", `"a" < "b"`, PyBool(true));
  assert("str-le-false", `"ac" <= "ab"`, PyBool(false));
  assert("str-lt-false", `"b" < "b"`, PyBool(false));
  assert("str-gt-false", `"abc" > "bbc"`, PyBool(false));

  assert("str-relational-operator-0", `${initStrs}\nt0 == t0`, PyBool(true));
  assert("str-relational-operator-1", `${initStrs}\nt0 != t0`, PyBool(false));
  assert("str-relational-operator-2", `${initStrs}\nt0  < t0`, PyBool(false));
  assert("str-relational-operator-3", `${initStrs}\nt0  > t0`, PyBool(false));
  assert("str-relational-operator-4", `${initStrs}\nt0 <= t0`, PyBool(true));
  assert("str-relational-operator-5", `${initStrs}\nt0 >= t0`, PyBool(true));
  
  assert("str-relational-operator-6", `${initStrs}\nt1 == t0`, PyBool(false));
  assert("str-relational-operator-7", `${initStrs}\nt1 != t0`, PyBool(true));
  assert("str-relational-operator-8", `${initStrs}\nt1  < t0`, PyBool(false));
  assert("str-relational-operator-9", `${initStrs}\nt1  > t0`, PyBool(true));
  assert("str-relational-operator-10", `${initStrs}\nt1 <= t0`, PyBool(false));
  assert("str-relational-operator-11", `${initStrs}\nt1 >= t0`, PyBool(true));
  
  assert("str-relational-operator-12", `${initStrs}\nt0 == t1`, PyBool(false));
  assert("str-relational-operator-13", `${initStrs}\nt0 != t1`, PyBool(true));
  assert("str-relational-operator-14", `${initStrs}\nt0  < t1`, PyBool(true));
  assert("str-relational-operator-15", `${initStrs}\nt0  > t1`, PyBool(false));
  assert("str-relational-operator-16", `${initStrs}\nt0 <= t1`, PyBool(true));
  assert("str-relational-operator-17", `${initStrs}\nt0 >= t1`, PyBool(false));

  assert("str-comparison-long-0", `"abcdefabcdef" == "abcdefabcdef"`, PyBool(true));
  assert("str-comparison-slice-0", `"abcdefabcdef"[1:3] == "abcdefabcdef"[1:3]`, PyBool(true));
  assert("str-comparison-slice-1", `"abcdefabcdef"[4] == "abcdefabcdef"[4]`, PyBool(true));
  assert("str-comparison-slice-2", `"abcdefabcdef"[-1] == "abcdefabcdef"[-1]`, PyBool(true));

  assert("iron-python-string-mult-test-0", `"aaaa" == "a" * 4`, PyBool(true));
  assert("iron-python-string-mult-test-1", `"aaa" == "a" * 3`, PyBool(true));
  
});
