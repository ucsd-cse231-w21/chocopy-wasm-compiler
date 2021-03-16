import { PyInt, PyBigInt, PyBool, PyNone, PyObj } from "../utils";
import { skipassert, assert, asserts, assertPrint, assertFail } from "./utils.test";

// We write end-to-end tests here to make sure the compiler works as expected.
// You should write enough end-to-end tests until you are confident the compiler
// runs as expected.
describe("run", () => {
  // runWasm('i64 return value', '(module (func (export "exported_func") (result i64) (i64.const 234)))', BigInt(234));

  assert("bignum-op-add", "4294967295 + 1", PyBigInt(4294967296n));

  assert("bignum-op-sub", "0 - 4294967295 - 1", PyBigInt(-4294967296n));

  assert("bignum-op-neg", "-4294967295", PyBigInt(-4294967295n));

  assert("bignum-op-mul", "4294967295 * 4294967295", PyBigInt(18446744065119617025n));

  assert("bignum-op-div", "18446744065119617025 // 4294967295", PyBigInt(4294967295n));

  assert("bignum-op-mod", "4294967296 % 4294967297", PyBigInt(4294967296n));

  assert("bignum-op-cmp", "1 > 4294967297", PyBool(false));

  assert(
    "num-reassign-to-bignum",
    `
  x:int = 1
  x = 4294967296
  x`,
    PyBigInt(4294967296n)
  );

  assert(
    "bignums-immutable",
    `
  a:int = 4294967296
  b:int = 1
  b = a
  b = b + 1
  a`,
    PyBigInt(4294967296n)
  );

  assert("add", "2 + 3", PyInt(2 + 3));

  assert("add3", "2 + 3 + 4", PyInt(2 + 3 + 4));

  assert("sub", "1 - 2", PyInt(1 - 2));

  assert("mul", "2 * 3 * 4", PyInt(2 * 3 * 4));

  assert("mul-then-plus", "2 + 3 * 4", PyInt(2 + 3 * 4));

  assert("bignum-abs", "abs(0 - 4294967295)", PyBigInt(4294967295n));

  assert("bignum-min", "min(4294967295, 4294967296)", PyBigInt(4294967295n));

  assert("bignum-max", "max(4294967295, 4294967296)", PyBigInt(4294967296n));

  assert("bignum-pow", "pow(4294967295, 2)", PyBigInt(18446744065119617025n));

  assert("bignum-pow-negative", "pow(4294967295, -2)", PyInt(0));

  assert("abs", "abs(0 - 5)", PyInt(Math.abs(0 - 5)));

  assert("min", "min(2, 3)", PyInt(Math.min(2, 3)));

  assert("max", "max(2, 3)", PyInt(Math.max(2, 3)));

  assert("pow", "pow(2, 3)", PyInt(Math.pow(2, 3)));

  assert("pow-negative", "pow(2, 0 - 1)", PyInt(0));

  assert("mod-args-different-signs", "-4 % 3", PyInt(2));

  assert("mod-args-different-signs", "4 % -3", PyInt(-2));

  assert("div-args-different-signs", "-4 // 3", PyInt(-2));

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

  assert("big num", "-1000000000000", PyBigInt(-1000000000000n));

  assert("add", "2 + 3", PyInt(2 + 3));

  assert("add3", "2 + 3 + 4", PyInt(2 + 3 + 4));

  assert("add-overflow", "4294967295 + 1", PyBigInt(4294967296n));

  assert("sub", "1 - 2", PyInt(1 - 2));

  assert("sub-underflow", "0 - 4294967295 - 1", PyBigInt(-4294967296n));

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
    "big num print (positive)",
    `
    print(4294967296)
  `,
    PyBigInt(4294967296n)
  );

  assert(
    "big num print (negative)",
    `
    print(-1000000000000)
  `,
    PyBigInt(-1000000000000n)
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

  assert(
    "big-num-as-object-field",
    `
    class Test(object):
      y:bool = True
      x:int = 4294967296

    t:Test = None
    t = Test()
    t.x`,
    PyBigInt(4294967296n)
  );

  assert(
    "class-object-field-resizable",
    `
    class Test(object):
      y:bool = True
      x:int = 4294967296

    t:Test = None
    t = Test()
    t.x = t.x + 9223372036854775808
    t.x`,
    PyBigInt(9223372041149743104n)
  );

  assert("test", `def f() -> int: return 1`, PyNone());

  assert(
    "empty-dict-init",
    `d:[int, int] = None
          d = {}`,
    PyNone()
  );

  assert(
    "empty-dict-constructor init",
    `d:[int, int] = None
          d = dict({})`,
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
    "key-val-pair-dict-constructor-init",
    `d:[int, int] = None
          d = dict({1:2, 3:4})
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
    "dict-get-method",
    `d:[int, int] = None
          d = {1:2, 2:10}
          d.get(1,100)
          `,
    PyInt(2)
  );

  assert(
    "dict-get-method-default",
    `d:[int, int] = None
          d = {1:2,2:10,15:25}
          d.get(5,100)
          `,
    PyInt(100)
  );

  assert(
    "dict-pop-method-return",
    `d:[int, int] = None
     d = {1:2,2:10,15:25}
     d.pop(2)
          `,
    PyInt(10)
  );

  assert(
    "dict-update-method",
    `d:[int, int] = None
     d = {1:2,2:10,15:25}
     d.update({5:100})
     d[5]
          `,
    PyInt(100)
  );

  assert(
    "dict-update-method-multiple-key-value-pairs",
    `d:[int, int] = None
     d = {1:2,5:10,15:25}
     d.update({5:100, 11: 22})
     d[5] + d.get(1,99) + d.get(12,99)
          `,
    PyInt(201)
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

  assert(
    "function-with-default-param",
    `
  def add_default_10(x : int, y : int = 10) -> int:
    return x + y`,
    PyNone()
  );
});

describe("defaults", () => {
  assert(
    "params default",
    `
  def foo(x : int = 3) -> int:
    return x

  foo()`,
    PyInt(3)
  );

  assert(
    "params default",
    `
  def foo(x : int = 3) -> int:
    return x

  foo(5)`,
    PyInt(5)
  );

  assert(
    "params default more params",
    `
  def foo(x : int = 3, y : int = 4) -> int:
    return x + y

  foo(5)`,
    PyInt(9)
  );

  assertPrint(
    "project-proposal program 1",
    `
  def add_default_10(x : int, y : int = 10) -> int:
	  return x + y

  print(add_default_10(20))
  print(add_default_10(20, 5))`,
    ["30", "25"]
  );

  assertPrint(
    "project-proposal program 2",
    `
  def add_defaults(x : int = 10, y : int = 20, z : int = 30) -> int:
	  return x + y + z

  print(add_defaults())
  print(add_defaults(40))`,
    ["60", "90"]
  );

  assertFail(
    "params default more params",
    `
  def foo(x : int, y : int = 4) -> int:
    return x + y

  foo()`
  );

  assert(
    "function-with-multiple-default-params",
    `
  def foo(x : int = 3, y : int = 4, z : int = 5) -> int:
    return x + y + z
  `,
    PyNone()
  );

  assertFail(
    "function-with-incorrect-default-param",
    `
  def foo(x : int = 3, y : int = 4, z : int) -> int:
    return x + y + z
  `
  );
});
