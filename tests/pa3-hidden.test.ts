import { PyInt, PyBool, PyNone, NUM, BOOL, CLASS, NONE } from "../utils";
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
  assertTC("none-assign", `
  class C(object):
    def f() -> int:
      return 0
  c : C = None
  c = None`, PyNone());

  assertTC("none-return", `
  class C(object):
    def none(self: C) -> C:
      return None
      
  C().none()`, CLASS("C"));

  assertTC("none-field-assign", `
  class C(object):
    box : C = None
    
  c : C = None
  c = C()
  c.box = None`, PyNone());

  // Type-checking block of method (keep checking after return?)
  assertTCFail("return-after-return", `
  class C(object):
    def f() -> int:
      return 1
      return False`);
  
  assertTCFail("tc-error-after-return", `
  class C(object):
    def f() -> int:
      return 1
      1 - True`);
  
  assertTCFail("no-return-just-expr", `
  class C(object):
    def f() -> int:
      1`);
  
  
  // What's the type of a block? (function without return should err)
  assertTC("top-level-type-none", `
  x : int = 0
  x = 5 + 5`, PyNone());

  assertTC("top-level-class", `
  class C(object):
    x : int = 0`, PyNone());
  
  assertTCFail("return-id", `
  class C(object):
    x : int = 0
    def f() -> int:
      x`);
  
  // Return in one branch of if but not the other
  assertTCFail("return-in-one-branch", `
  class C(object):
    def f() -> int:
      if True:
        return 0
      else:
        pass`);

  assertTCFail("return-none-in-branch", `
  class C(object):
    def f() -> int:
      if True:
        return 0
      else:
        return`
    );

  // Check none is none
  assert("none-is-none", `
  None is None`, PyBool(true));

  /*assertTC("void-is-none-tc", `    
  class C(object):
    def new(self: C, other: C) -> C:
      return other
    def f(self: C):
      return

  C().new(None).f()`, NONE);

  assert("void-is-none", `    
  class C(object):
    def new(self: C) -> C:
      return self
    def f(self: C):
      return 

  C().new().f() is None`, PyBool(true)); */

  assert("alias-is-same", `
  class C(object):
    x : int = 0
    
  c1 : C = None
  c2 : C = None
  c1 = C()
  c2 = c1
  c1 is c2`, PyBool(true));


  // NullPointerException (access fields/methods of None dynamically when it's a class)
  assertTC("field-of-none-tc", `
  class C(object):
    x : int = 0
  c : C = None
  c.x`, NUM);

  assertFail("field-of-none", `
  class C(object):
    x : int = 0
  c1 : C = None
  c2 : C = None
  c1 = C()
  c2.x`);

  assertFail("method-of-none", `
  class C(object):
    other : C = None
    def f(self:C, other: C):
      other.f()
    
  c : C = None
  c = c()
  c.f(None)`);

  // Check objects not equal (same classes, different classes, compare to none)
  // Type-checking of is (can't use int/bool)
  assertTC("is-different-classes", `
  class C1(object):
    x : int = 0
  class C2(object):
    x : int = 0
    
  C1() is C2()`, BOOL);

  assertTCFail("is-num", `
  x : int = 0
  y : int = 0
  y = x
  x is y`);

  // Type-checking of == (can't use none/object)
  assertTCFail("eq-int-bool", `
  1 == True
  `)

  assertTCFail("eq-class", `
  class C(object):
    x : int = 0
  C() == C()`);

  // Type-checking binary expressions with equal sides (bool, classes, not int)
  assertTCFail("plus-bool", `
  True + True`);

  // Type-check bad arguments in method call
  assertTCFail("int-arg-not-bool", `
  class C(object):
    def f(x : int) -> int:
      return 0
      
  C().f(True)`);

  // Type-check method calls in general


  // Check assignability of None to args
  assertTC("none-arg", `
  class C(object):
    def new(self: C, other: C) -> C:
      return self

  C().new(None)`, CLASS("C"));

  // Does __init__ get called
  assertTCFail("init-no-args", `
  class C(object):
    n : int = 0
    def __init__(self: C, n : int):
      self.n = n`);
  
  assertTCFail("init-ret-type-1", `
  class C(object):
    n : int = 0
    def __init__(self: C) -> C:
      self.n = 1`);

  assertTC("init-ret-type-2", `
  class C(object):
    n : int = 0
    def __init__(self: C):
      self.n = 1`, PyNone());

  assert("init-gets-called", `
  class C(object):
    n : int = 0
    def __init__(self: C):
      self.n = 1
      
  C().n`, PyInt(1));


  // Recursive method calls
  assertTC("recursive-call-tc", `
  class C(object):
    def fib(self: C, n: int) -> int:
      if n <= 0:
        return 1
      else:
        return n * self.fib(n-1)
  
  C().fib(5)`, NUM);

  assertTCFail("recursive-call-tc-fails", `
  class C(object):
    def fib(self: C, n: int):
      if n <= 0:
        return 1
      else:
        return n * self.fib(n-1)
  
  C().fib(5)`);

  asserts("recursive-call", [
    [`
  class C(object):
    def fib(self: C, n: int) -> int:
      if n <= 0:
        return 1
      else:
        return n * self.fib(n-1)`, PyNone()],
    [`C().fib(5)`, PyInt(120)]
  ])

  // Linked list with sum method with None as empty – realistic example
  asserts("linked-list", [
    [`
class LinkedList(object):
  value : int = 0
  next: LinkedList = None
  def new(self: LinkedList, value: int, next: LinkedList) -> LinkedList:
    self.value = value
    self.next = next
    return self

  def sum(self: LinkedList) -> int:
    if self.next is None:
      return self.value
    else:
      return self.value + self.next.sum()`, PyNone()],
    [`l: LinkedList = None`, PyNone()],
    [`l = LinkedList().new(1, LinkedList().new(2, LinkedList().new(3, None)))`, PyNone()],
    [`l.sum()`, PyInt(6)],
    [`l.next.sum()`, PyInt(5)]
  ]);

  assertTC(
    "linked-list-tc",
    `
class LinkedList(object):
  value : int = 0
  next: LinkedList = None
  def new(self: LinkedList, value: int, next: LinkedList) -> LinkedList:
    self.value = value
    self.next = next
    return self

  def sum(self: LinkedList) -> int:
    if self.next is None:
      return self.value
    else:
      return self.value + self.next.sum()

l: LinkedList = None
l = LinkedList().new(1, LinkedList().new(2, LinkedList().new(3, None)))
l.next.sum()`, NUM);


});
