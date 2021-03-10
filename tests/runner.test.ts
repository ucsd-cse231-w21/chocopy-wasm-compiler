import { PyInt, PyBigInt, PyBool, PyNone, PyObj } from "../utils";
import { skipassert, assert, asserts, assertPrint, assertFail } from "./utils.test";

// We write end-to-end tests here to make sure the compiler works as expected.
// You should write enough end-to-end tests until you are confident the compiler
// runs as expected.
describe("run", () => {
  // runWasm('i64 return value', '(module (func (export "exported_func") (result i64) (i64.const 234)))', BigInt(234));

  assert("big num", "-1000000000000", PyBigInt(-1000000000000n));

  assert("add", "2 + 3", PyInt(2 + 3));

  assert("add3", "2 + 3 + 4", PyInt(2 + 3 + 4));

  skipassert("add-overflow", "4294967295 + 1", PyBigInt(4294967296n));

  assert("sub", "1 - 2", PyInt(1 - 2));

  skipassert("sub-underflow", "0 - 4294967295 - 1", PyBigInt(-4294967296n));

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

  assertPrint(
    "print-1-string",
    `
  print("ABC")`,
    ["ABC"]
  );

  assertPrint(
    "print-2-strings",
    `
  print("Compiler")
  print("Design")`,
    ["Compiler", "Design"]
  );

  assertPrint(
    "string-variables-printing",
    `
  x : str = "Compiler"
  print(x)`,
    ["Compiler"]
  );

  assertPrint(
    "print-string-index",
    `
  print("Design"[2])`,
    ["s"]
  );

  assertPrint(
    "print-negative-string-index",
    `
  print("Design"[-2])`,
    ["g"]
  );

  assertPrint(
    "print-string-variable-negative-index",
    `
  a:str="ABCDE"
  print(a[-3])`,
    ["C"]
  );

  assertPrint(
    "function-with-strings",
    `
  def func():
    print("Compiler")
  func()`,
    ["Compiler"]
  );

  assertPrint(
    "function-with-string-variable",
    `
  def func()->str:
    a:str="Compiler"
    return a

  print(func())`,
    ["Compiler"]
  );

  assertPrint(
    "function-with-string-return-and-string-param",
    `
  def func(a:str)->str:
    print(a)
    return a[2]

  print(func("Compiler"))
    `,
    ["Compiler", "m"]
  );

  assertPrint(
    "class-with-string-fields",
    `
  class C(object):
    x : str = "Compiler"
    y : str = "Design"

  c1 : C = None
  c1 = C()
  print(c1.x)
  c1.x = "ABC"
  print(c1.x)`,
    ["Compiler", "ABC"]
  );

  assertPrint(
    "class-with-string-fields-inside-methods",
    `
  class C(object):
    x : str = "ZZZ"

    def func(self:C, z:str)->str:
      self.x = z
      return self.x

  c1 : C = None
  c1 = C()
  print(c1.func("AAA"))`,
    ["AAA"]
  );

  assertPrint(
    "string-index-inside-class",
    `
  class C(object):
    x : str = "PQR"

    def func(self:C)->str:
      return self.x[2]

  c1 : C = None
  c1 = C()
  print(c1.func())`,
    ["R"]
  );

  assertPrint(
    "negative-string-index-inside-class",
    `
  class C(object):
    x : str = "PQR"

    def func(self:C)->str:
      return self.x[-2]

  c1 : C = None
  c1 = C()
  print(c1.func())`,
    ["Q"]
  );

  assert("string-length", `len("abc")`, PyInt(3));

  assert(
    "string-length-variable",
    `
  a:str="ABCD"
  len(a)`,
    PyInt(4)
  );

  assert("empty-string-length", `len("")`, PyInt(0));

  assertPrint(
    "print-string-index-nested-index",
    `
  a:str="ABC"
  b:str="DEF"

  def f(x:str)->int:
    return len(x)

  print(a[f(b[2])])`,
    ["B"]
  );

  assertPrint(
    "print-string-slicing-basic-one",
    `
  print("Design"[2:3])`,
    ["s"]
  );

  assertPrint(
    "print-string-slicing-basic-multiple",
    `
  print("Design"[2:4])`,
    ["si"]
  );

  assertPrint(
    "print-string-slicing-basic-from-start",
    `
  print("Design"[0:2])`,
    ["De"]
  );

  assertPrint(
    "print-string-slicing-basic-till-end",
    `
  print("Design"[2:6])`,
    ["sign"]
  );

  assertPrint(
    "print-string-slicing-from-start-without-start",
    `
  print("Design"[:2])`,
    ["De"]
  );

  assertPrint(
    "print-string-slicing-till-end-without-end",
    `
  print("Design"[2:])`,
    ["sign"]
  );

  assertPrint(
    "print-string-slicing-full-without-start-or-end",
    `
  print("Design"[:])`,
    ["Design"]
  );

  assert(
    "print-string-slicing-full-without-start-or-end-length",
    `
  print(len("Design"[:]))`,
    PyInt(6)
  );

  assertPrint(
    "print-string-slicing-neg-start-pos-end",
    `
  print("Design"[-3:5])`,
    ["ig"]
  );

  assertPrint(
    "print-string-slicing-neg-start-till-end",
    `
  print("Design"[-3:])`,
    ["ign"]
  );

  assertPrint(
    "print-string-slicing-neg-start-neg-end",
    `
  print("Design"[-3:-1])`,
    ["ig"]
  );

  assertPrint(
    "print-string-pos-1-stride-slicing-neg-start-neg-end",
    `
  print("Design"[-3:-1:1])`,
    ["ig"]
  );

  assertPrint(
    "print-string-pos-2-stride-slicing-neg-start-neg-end",
    `
  print("Design"[0:6:2])`,
    ["Dsg"]
  );

  assertPrint(
    "print-string-pos-3-stride-slicing-neg-start-neg-end",
    `
  print("Design"[0:6:3])`,
    ["Di"]
  );

  assertPrint(
    "print-string-empty-start-empty-end-neg-stride",
    `
  print("Design"[::-1])`,
    ["ngiseD"]
  );

  assertPrint(
    "print-string-neg-1-stride-slicing-neg-start-neg-end",
    `
  print("Design"[-1:-3:-1])`,
    ["ng"]
  );

  assertPrint(
    "print-string-neg-2-stride-slicing-neg-start-neg-end",
    `
  print("Design"[-1:-6:-2])`,
    ["nie"]
  );

  assertPrint(
    "print-string-neg-3-stride-slicing-neg-start-empty-end",
    `
  print("Design"[-1::-3])`,
    ["ns"]
  );

  assertPrint(
    "print-string-pos-stride-slicing-end>length",
    `
  print("Design"[0:20:1])`,
    ["Design"]
  );

  assertPrint(
    "print-string-neg-stride-slicing-start>=length",
    `
  print("Design"[25:3:-1])`,
    ["ng"]
  );

  assertPrint(
    "print-string-pos-stride-slicing-start>=end",
    `
  print("Design"[4:2:1])`,
    [""]
  );

  assertPrint(
    "print-string-neg-stride-slicing-end>=start",
    `
  print("Design"[2:4:-1])`,
    [""]
  );

  assert(
    "string-length-variable-empty-slice",
    `
  a:str="ABCD"
  a=a[4:2:1]
  len(a)`,
    PyInt(0)
  );

  assertPrint(
    "print-string-concat",
    `
  print("Design"+"ABC")`,
    ["DesignABC"]
  );

  assertPrint(
    "print-string-concat-variable",
    `
  a:str="Compiler"
  b:str=" Design"
  print(a+b)`,
    ["Compiler Design"]
  );

  assertPrint(
    "print-string-multiply",
    `
  a:str="Compiler"
  print(a*2)`,
    ["CompilerCompiler"]
  );

  assertPrint(
    "print-string-concat-multiply-variable",
    `
  a:str="AB"
  b:str="CD"
  print((a+b)*2)`,
    ["ABCDABCD"]
  );

  assertPrint(
    "print-string-slice-concat",
    `
  a:str="Compiler"
  b:str="commuter"
  print(a[0:4] + b[-4:])`,
    ["Computer"]
  );

  assertPrint(
    "print-string-slice-concat-multiply",
    `
  a:str="Compiler"
  b:str="Commuter"
  print((a[0:4] + b[-4:])*3)`,
    ["ComputerComputerComputer"]
  );

  assertPrint(
    "print-string-equals",
    `
  a:str="Compiler"
  b:str="Algorithms"
  print(a == b)`,
    ["False"]
  );

  assertPrint(
    "print-string-greater-than",
    `
  a:str="Compiler"
  b:str="Algorithms"
  print(a > b)`,
    ["True"]
  );

  assertPrint(
    "print-string-greater-than-2",
    `
  a:str="Compiler"
  print(a > a)`,
    ["False"]
  );

  assertPrint(
    "print-string-greater-equals",
    `
  a:str="Compiler"
  print(a >= a)`,
    ["True"]
  );

  assertPrint(
    "print-string-less-than",
    `
  a:str="Compiler"
  b:str="Commuter"
  print(a < b)`,
    ["False"]
  );

  assertPrint(
    "print-string-less-than-2",
    `
  a:str="Compiler"
  print(a < a)`,
    ["False"]
  );

  assertPrint(
    "print-string-less-equals",
    `
  a:str="Compiler"
  print(a <= a)`,
    ["True"]
  );

  assertPrint(
    "print-string-not-equals",
    `
  a:str="Compiler"
  b:str="Commuter"
  print(a != b)`,
    ["True"]
  );

  assertPrint(
    "print-string-not-equals-2",
    `
  a:str="Compiler"
  b:str="Compiler"
  print(a != b)`,
    ["False"]
  );

  assertPrint(
    "print-string-escape-nextline",
    `
  a:str="Apple\nBall"
  print(a)`,
    ["Algo\nBall"]
  );

  assertPrint(
    "print-string-escape-tab",
    `
  a:str="Apple\tBall"
  print(a)`,
    ["Algo    Ball"]
  );
});
