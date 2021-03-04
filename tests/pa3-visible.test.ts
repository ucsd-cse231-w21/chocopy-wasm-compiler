import { PyInt, PyBool, PyNone, NUM, CLASS } from "../utils";
import { assert, asserts, assertPrint, assertTCFail, assertTC, assertFail } from "./utils.test";

describe("PA3 visible tests", () => {
  // 1
  assert("literal-int-ops", `100 + 20 + 3`, PyInt(123));
  // 2
  assert("literal-bool", `True`, PyBool(true));
  // 3
  assertPrint(
    "print-int-print-bool",
    `
  print(0)
  print(False)`,
    ["0", "False"]
  );
  // 4
  asserts("basic-global-repl", [
    [`x : int = 0`, PyNone()],
    [`x`, PyInt(0)],
    [`x = -1 * -1`, PyNone()],
    [`x`, PyInt(1)],
  ]);
  // 5
  asserts("basic-if", [
    [`x : int = 0`, PyNone()],
    [
      `
if True:
  x = 5
else:
  x = 3`,
      PyNone(),
    ],
    [`x`, PyInt(5)],
  ]);
  // 6
  assert(
    "basic-class-lookup",
    `
  class C(object):
    x : int = 123

  c : C = None
  c = C()
  c.x `,
    PyInt(123)
  );
  // 7
  assert(
    "basic-class-field-assign",
    `
  class C(object):
    x : int = 123

  c : C = None
  c = C()
  c.x = 42
  c.x`,
    PyInt(42)
  );
  // 8
  asserts("basic-class-method", [
    [
      `
  class C(object):
    x : int = 123
    def getX(self: C) -> int:
      return self.x
    def setX(self: C, x: int):
      self.x = x`,
      PyNone(),
    ],
    [`c : C = None`, PyNone()],
    [`c = C()`, PyNone()],
    [`c.getX()`, PyInt(123)],
    [`c.setX(42)`, PyNone()],
    [`c.getX()`, PyInt(42)],
  ]);
  // 9
  asserts("new-class-repl", [
    [
      `
    class C(object):
      x : int = 1
      y : int = 2`,
      PyNone(),
    ],
    [
      `
    class D(object):
      y : int = 3
      x : int = 4`,
      PyNone(),
    ],
    [`c : C = None`, PyNone()],
    [`c = C()`, PyNone()],
    [`d : D = None`, PyNone()],
    [`d = D()`, PyNone()],
    [`c.x`, PyInt(1)],
    [`d.x`, PyInt(4)],
  ]);
  // 10
  asserts("alias-obj", [
    [
      `
    class C(object):
      x : int = 1`,
      PyNone(),
    ],
    [
      `
    c1 : C = None
    c2 : C = None`,
      PyNone(),
    ],
    [
      `
    c1 = C()
    c2 = c1`,
      PyNone(),
    ],
    [
      `
    c1.x = 123
    c2.x`,
      PyInt(123),
    ],
  ]);
  // 11
  assertPrint(
    "chained-method-calls",
    `
  class C(object):
    x : int = 123
    def new(self: C, x: int) -> C:
      print(self.x)
      self.x = x
      print(self.x)
      return self
    def clear(self: C) -> C:
      return self.new(123)

  C().new(42).clear()`,
    ["123", "42", "42", "123"]
  );
  // 12
  assertFail(
    "no-fields-for-none",
    `
  class C(object):
    x : int = 0

  c : C = None
  c.x`
  );
  // 13
  assert(
    "constructor-non-none",
    `
  class C(object):
    x : int = 0
  not (C() is None)`,
    PyBool(true)
  );
  // 14
  assertTC(
    "non-literal-condition",
    `
x : int = 1
y : int = 2
if x < y:
  pass
else:
  x = -x
x`,
    NUM
  );
  // 15
  assertTC(
    "tc-two-classes",
    `
  class C(object):
    d : D = None

  class D(object):
    c : C = None
  c : C = None
  c.d
  `,
    CLASS("D")
  );
  // 16
  assertTC(
    "tc-two-classes-methods",
    `
  class C(object):
    d : D = None
    def new(self: C, d : D) -> C:
      self.d = d
      return self

  class D(object):
    c : C = None
    def new(self: D, c: C) -> D:
      self.c = c
      return self

  c : C = None
  d : D = None
  c = C().new(d)
  c.d.c`,
    CLASS("C")
  );
  // 17
  assertTC(
    "none-assignable-to-object",
    `
  class C(object):
    x : int = 1
    def clear(self: C) -> C:
      return None

  c : C = None
  c = C().clear()
  c`,
    CLASS("C")
  );
  // 18
  assertTC(
    "constructor-type",
    `
  class C(object):
    x : int = 0

  C()`,
    CLASS("C")
  );
  // 19
  assertTCFail(
    "tc-literal",
    `
  x : int = None`
  );
  // 20
  assertTC(
    "assign-none",
    `
  class C(object):
    x : int = 0
  c : C = None
  c = None`,
    PyNone()
  );

  assertFail(
    "missing-else",
    `
if True:
  pass`
  );

  assert(
    "import statement test 1",
    `
    from otherModule import someFunc
    someFunc()
  `,
    PyNone()
  );

  assert(
    "import statement test 1",
    `
    from otherModule import someFunc, otherFunc
    someFunc()
    otherFunc()
  `,
    PyNone()
  );
});
