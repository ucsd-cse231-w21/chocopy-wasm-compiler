// -*- mode: typescript; typescript-indent-level: 2; -*-

import { PyInt, PyBool, PyNone, PyStr, NUM, CLASS } from "../utils";
import { assert, asserts, assertPrint, assertTCFail, assertTC, assertFail } from "./utils.test";

const initStrs = `t0: str = "Hello!"\nt1: str = "World"\nnumbers: str = "1 2 3 4 5 6 7 8"`;

describe("String tests", () => {
  assert("static-allocation-0", `t0: str = "Hello! world\nt1: str = "Hmmm..."\nt1`, PyStr(44));
  assert("static-allocation-1", `t0: str = "Hello! world\nt1: str = "Hmmm..."\nt0`, PyStr(32));

  assert("length", `len("abc")`, PyInt(3));
  
  assertPrint("concat-0", `${initStrs}\nprint(t0 + " " + t1)`, [`Hello! World`]);
  assertPrint("concat-1", `${initStrs}\nt3: str = t0 + " "\nprint(t3 + t1)`, [`Hello! World`]);

  assertPrint("for-loop", `${initStrs}\niter: str = None\nfor iter in t0:\n  print(iter)`, [`H`, `e`, `l`, `l`, `o`, `!`]);
  assertPrint("for-loop-comparison", `${initStrs}\niter: str = None\nfor iter in t0:\n  if iter == "H":\n    print(iter)`, [`H`]);
});
