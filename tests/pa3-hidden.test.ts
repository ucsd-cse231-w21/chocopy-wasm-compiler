import { PyInt, PyBool, PyNone, NUM, CLASS } from "../utils";
import { assert, asserts, assertPrint, assertTCFail, assertTC, assertFail } from "./utils.test";

describe("PA3 hidden tests", () => {

  assertTC("call-type-checking", `
class C(object):
  def f(self : C, x : int) -> int:
    return x * 2

c : C = None
c = C()
c.f(4) + c.f(c.f(2))
  `, NUM);

  assertTCFail("call-type-checking-fail", `
class C(object):
  def f(self : C, x : int) -> int:
    return x * 2

c : C = None
c = C()
if c.f(c.f(2)):
  pass
else:
  pass
  `);

  // Assignability tests, None into class (return, assign, field assign)
  // Type-checking block of method (keep checking after return?)
  // What's the type of a block? (function without return should err)
  // Return in one branch of if but not the other
  // Check none is none
  // NullPointerException (access fields/methods of None dynamically when it's a class)
  // Check objects not equal (same classes, different classes, compare to none)
  // Type-checking of is (can't use int/bool)
  // Type-checking of == (can't use none/object)
  // Type-checking binary expressions with equal sides (bool, classes, not int)
  // Type-check bad arguments in method call
  // Type-check method calls in general
  // Check assignability of None to args
  // Does __init__ get called
  // Recursive method calls
  // Linked list with sum method with None as empty – realistic example



});
