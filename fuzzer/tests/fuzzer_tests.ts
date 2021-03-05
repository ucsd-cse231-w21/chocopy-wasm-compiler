import { PyInt, PyBool, PyNone, NUM, BOOL, CLASS, NONE } from "../../utils";
import {
  assert,
  asserts,
  assertPrint,
  assertTCFail,
  assertTC,
  assertFail,
} from "../../tests/utils.test";

describe("PA3 hidden tests", () => {
  assertTC(
    "call-type-checking",
    `
class C(object):
  def f(self : C, x : int) -> int:
    return x * 2

c : C = None
c = C()
c.f(4) + c.f(c.f(2))
  `,
    NUM
  );
});
