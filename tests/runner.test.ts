import { PyInt, PyBool, PyNone, PyObj } from "../utils";
import { assert, asserts, assertPrint } from "./utils.test";

// We write end-to-end tests here to make sure the compiler works as expected.
// You should write enough end-to-end tests until you are confident the compiler
// runs as expected.
describe("run", () => {
  // runWasm('i64 return value', '(module (func (export "exported_func") (result i64) (i64.const 234)))', BigInt(234));

  assert("add", "2 + 3", PyInt(2 + 3));

  assert("add3", "2 + 3 + 4", PyInt(2 + 3 + 4));

  assert("add-overflow", "4294967295 + 1", PyInt(0));

  assert("sub", "1 - 2", PyInt(1 - 2));

  assert("sub-underflow", "0 - 4294967295 - 1", PyInt(0));

  assert("mul", "2 * 3 * 4", PyInt(2 * 3 * 4));

  assert("mul-then-plus", "2 + 3 * 4", PyInt(2 + 3 * 4));

  assert("abs", "abs(0 - 5)", PyInt(Math.abs(0 - 5)));

  assert("min", "min(2, 3)", PyInt(Math.min(2, 3)));

  assert("max", "max(2, 3)", PyInt(Math.max(2, 3)));

  assert("pow", "pow(2, 3)", PyInt(Math.pow(2, 3)));

  assert("pow-negative", "pow(2, 0 - 1)", PyInt(0));

  assert("simple-def", "def f(x: int) -> int: return x + 1\nf(5)", PyInt(6));

  assert(
    "multi-arg",
    "def f(x: int, y: int, z: int) -> int: return x - y - z\nf(9, 3, 1)",
    PyInt(5)
  );

  assert(
    "multi-arg-again",
    "def f(x: int, y: int, z: int) -> int: return x * y - z\nf(9, 3, 1)",
    PyInt(26)
  );

  assert(
    "multi-arg-update",
    `
def f(x: int, y: int, z: int) -> int:
  x = y * x
  return x - z
f(9, 3, 1)`,
    PyInt(26)
  );

  assert(
    "multi-arg-local-var",
    `
def f(x: int, y: int, z: int) -> int:
  m : int = 0
  m = y * x
  return m - z
f(9, 3, 1)`,
    PyInt(26)
  );

  assert(
    "global-local-same-name",
    `
x : int = 1
def f(y : int) -> int:
  x : int = 2
  return x

f(0)`,
    PyInt(2)
  );

  assert("true", "True", PyBool(true));

  assert("false", "False", PyBool(false));

  assert("true and false", "True and False", PyBool(false));

  assert("true and true", "True and True", PyBool(true));

  assert("false and false", "False and False", PyBool(false));

  assert(
    "iftrue",
    `
if True:
  5
else:
  3`,
    PyInt(5)
  );

  assert(
    "nestedif",
    `
if True:
  if False:
    0
  else:
    1
else:
  2`,
    PyInt(1)
  );

  assert(
    "return inside if",
    `
def f(x : int) -> int:
  if x > 0:
    return x
  else:
    return 0
f(2)`,
    PyInt(2)
  );

  assert(
    "init only",
    `
  x : int = 2
  x`,
    PyInt(2)
  );

  assert(
    "init before assign",
    `
  x : int = 0
  x = x + 2
  x`,
    PyInt(2)
  );

  assert(
    "two inits",
    `
  x : int = 1
  y : int = 2
  y = y + x
  y`,
    PyInt(3)
  );

  assert(
    "init before def",
    `
  x : int = 2
  def f() -> int:
    return x
  f()`,
    PyInt(2)
  );

  assert(
    "id fun 1",
    `
  def id(x: int) -> int:
    return x
  id(1)`,
    PyInt(1)
  );

  assert(
    "id fun 2",
    `
  def id_helper(x : int) -> int:
    return x

  def id(x: int) -> int:
    return id_helper(x)

  id(1) + id(2)`,
    PyInt(3)
  );

  assert(
    "fib(1)",
    `
  def fib(n : int) -> int:
    if n < 2:
      return 1
    else:
      return n * fib(n - 1)
  fib(1)`,
    PyInt(1)
  );

  assert(
    "fib(2)",
    `
  def fib(n : int) -> int:
    if n < 2:
      return 1
    else:
      return n * fib(n - 1)
  fib(2)`,
    PyInt(2)
  );

  assert(
    "fib(3)",
    `
  def fib(n : int) -> int:
    if n < 2:
      return 1
    else:
      return n * fib(n - 1)
  fib(3)`,
    PyInt(6)
  );

  assert(
    "mutual recursion1",
    `
  def is_even(x : int) -> bool:
    if x < 1:
      return True
    else:
      return is_odd(x-1)

  def is_odd(x : int) -> bool:
    return is_even(x - 1)

  is_even(4)`,
    PyBool(true)
  );

  assert(
    "mutual recursion2",
    `
  def is_even(x : int) -> bool:
    if x < 1:
      return True
    else:
      return is_odd(x-1)

  def is_odd(x : int) -> bool:
    if x < 1:
      return False
    else:
      return is_even(x - 1)

  is_even(3)`,
    PyBool(false)
  );

  assert(
    "two prints",
    `
  print(True)
  print(1)`,
    PyInt(1)
  );

  assert(
    "while true",
    `
  x : int = 3
  fib : int = 1
  while x > 1:
    fib = fib * x
    x = x - 1
  fib`,
    PyInt(6)
  );

  assertPrint(
    "while False",
    `
while False:
  print(0)`,
    [""]
  );

  assert(
    "parenthesized expr",
    `
  (1 + 1) * 5`,
    PyInt(10)
  );

  assert("negative", `-1`, PyInt(-1));

  assert("negative", `not True`, PyBool(false));

  assert("negative", `not False`, PyBool(true));

  assertPrint(
    "print-assert",
    `
  print(1)
  print(True)`,
    ["1", "True"]
  );

  assertPrint(
    "class-with-fields",
    `
  class C(object):
    x : int = 1
    y : int = 2

  c1 : C = None
  c1 = C()
  print(c1.x)
  c1.x = 2
  print(c1.x)`,
    ["1", "2"]
  );

  assert(
    "class-with-field",
    `
  class C(object):
    x : int = 1

  c1 : C = None
  c1 = C()
  c1.x`,
    PyInt(1)
  );

  assert(
    "class-with-field-assign",
    `
  class C(object):
    x : int = 1
    y : int = 2
  c1 : C = None
  c1 = C()
  c1.x = c1.y
  c1.x`,
    PyInt(2)
  );

  assert(
    "class-with-method",
    `
    class C(object):
      x : int = 1
      y : int = 2

      def new(self : C, x : int, y : int) -> C:
        self.x = x
        self.y = y
        return self

    c : C = None
    c = C().new(3, 4)
    c.x`,
    PyInt(3)
  );

  assert("test", `def f() -> int: return 1`, PyNone());

  assert(
    "empty-dict-init",
    `d:[int, int] = None
          d = {}`,
    PyNone()
  );

  assert(
    "key-val-pair-dict-init",
    `d:[int, int] = None
          d = {1:2}
          `,
    PyNone()
  );

  assert(
    "dict-bracket-assign",
    `d:[int, int] = None
          d = {1:2}
          d[2] = 3`,
    PyNone()
  );

  assert(
    "dict-bracket-lookup",
    `d:[int, int] = None
     x:int = 0
     d = {1:2}
     x = d[1]
     x`,
    PyInt(2)
  );

  assert(
    "dict-bracket-lookup-along-collision-chain",
    `d:[int, int] = None
     x:int = 0
     d = {1:2, 11:22, 21:44, (30+1):56, 4:55}
     x = d[31]
     x`,
    PyInt(56)
  );

  asserts("multi-repl", [
    [`def f() -> int: return 1`, PyNone()],
    [`f()`, PyInt(1)],
    [
      `def g() -> int:
        return 2`,
      PyNone(),
    ],
    [`g()`, PyInt(2)],
  ]);

  assert(
    "return-none",
    `
  class C(object):
    x : int = 123

  c : C = None
  c`,
    PyNone()
  );

  assert(
    "function-with-default-arg",
    `
  def add_default_10(x : int, y : int = 10) -> int:
	  return x + y
  `,
    PyNone()
  );
});
