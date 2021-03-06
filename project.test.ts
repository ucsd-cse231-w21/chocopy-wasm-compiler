// -*- mode: typescript; typescript-indent-level: 2; -*-

import { PyInt, PyBool, PyNone, PyStr, NUM, CLASS } from "../utils";
import { assert, asserts, assertPrint, assertTCFail, assertTC, assertFail } from "./utils.test";

const initStrs = `t0: str = "Hello!"\nt1: str = "World"`;

describe("String tests", () => {
  assert("static-allocation-0", `t0: str = "Hello! world\nt1: str = "Hmmm..."\nt1`, PyStr(36));
  assert("static-allocation-1", `t0: str = "Hello! world\nt1: str = "Hmmm..."\nt0`, PyStr(24));

  assertPrint("concat-0", `${initStrs}\nprint(t0 + " " + t1)`, [`Hello! World`]);
  assertPrint("concat-1", `${initStrs}\nt3: str = t0 + " "\nprint(t3 + t1)`, [`Hello! World`]);

  assertPrint("slice-single-literal", `${initStrs}\nprint("ABCDEF"[3])`, [`D`]);
  assertPrint("slice-single-var", `${initStrs}\nprint(t0[3])`, [`l`]);
  assertPrint("slice-range-literal", `${initStrs}\nprint("ABCDEF"[0:3])`, [`ABC`]);
  assertPrint("slice-range-var", `${initStrs}\nt2: str = t0 + " " + t1\nprint(t2[3:5])`, [`lo`]);

  assertPrint("slice-range-step", `nums: str = "1 2 3 4 5 6"\nprint(nums[0:len(nums):2])`, [`123456`]);

  assertPrint("for-loop", `${initStrs}\niter: str = None\nfor iter in t0:\n  print(iter)`, [`H`, `e`, `l`, `l`, `o`, `!`]);
  assertPrint("for-loop-comparison", `${initStrs}\niter: str = None\nfor iter in t0:\n  if iter == "H":\n    print(iter)`, [`H`]);
});
