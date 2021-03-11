import { PyInt, PyBool, PyNone, PyObj, LIST } from "../utils";
import { assert, asserts, assertPrint, assertTC, assertTCFail, assertFail } from "./utils.test";

describe("STRINGS TEST", () => {
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
    "print-2-strings-var",
    `
  a:str="ABCD"
  print(a)
  print(a)`,
    ["ABCD", "ABCD"]
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
    "print-string-index-nested-index-1",
    `
  a:str="ABC"
  b:str="DEF"

  def f(x:str)->int:
    return 1

  print(a[f(b[2])])`,
    ["B"]
  );

  assertPrint(
    "print-string-index-nested-index-2",
    `
  a:str="ABC"
  b:str="DEF"

  print(a[len(b[2])])`,
    ["B"]
  );

  assert(
    "print-string-index-nested-index-3",
    `
  a:str="ABC"
  b:str="DEF"

  def f(x:str)->int:
    return len(x)

  print(f(b))`,
    PyInt(3)
  );

  assertPrint(
    "print-string-slicing-basic-one",
    `
  print("Design"[2:3])`,
    ["s"]
  );

  assert(
    "print-string-slicing-basic-one-length",
    `
  len("Design"[2:3])`,
    PyInt(1)
  );

  assertPrint(
    "print-string-slicing-basic-multiple",
    `
  a:str="Design"
  print(a[2:4])
  print(a[2:3])
  print(a[2:3])`,
    ["si", "s", "s"]
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
  a:str="Design"
  print(a[0:20:1])
  print(a[0:3])`,
    ["Design", "Des"]
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
    "print-string-slice-concat-multiply",
    `
  a:str="Compiler"
  b:str="Commuter"
  print((a[0:4] + b[-4:])*3)`,
    ["ComputerComputerComputer"]
  );

  assertPrint(
    "print-string-escape-seq-new-line",
    `
  print("Design\\nABC")`,
    ["Design", "ABC"]
  );

  assertPrint(
    "print-string-escape-seq-new-tab",
    `
  print("Design\\tABC")`,
    ["Design\tABC"]
  );

  assertPrint(
    "print-string-escape-quotes",
    `
  a:str="Apple\\"Ball"
  print(a)`,
    ['Apple"Ball']
  );

  assertPrint(
    "print-string-escape-backslash",
    `
  a:str="Apple\\\\Ball"
  print(a)`,
    ["Apple\\Ball"]
  );

  assert(
    "print-string-equals",
    `
  a:str="Compiler"
  b:str="Algorithms"
  print(a == b)`,
    PyBool(false)
  );

  assert(
    "print-string-greater-than",
    `
  a:str="Compiler"
  b:str="Algorithms"
  print(a > b)`,
    PyBool(true)
  );

  assert(
    "print-string-greater-than-2",
    `
  a:str="Compiler"
  print(a > a)`,
    PyBool(false)
  );

  assert(
    "print-string-greater-equals",
    `
  a:str="Compiler"
  print(a >= a)`,
    PyBool(true)
  );

  assert(
    "print-string-less-than",
    `
  a:str="Compiler"
  b:str="Commuter"
  print(a < b)`,
    PyBool(false)
  );

  assert(
    "print-string-less-than-2",
    `
  a:str="Compiler"
  print(a < a)`,
    PyBool(false)
  );

  assert(
    "print-string-less-equals",
    `
  a:str="Compiler"
  print(a <= a)`,
    PyBool(true)
  );

  assert(
    "print-string-not-equals",
    `
  a:str="Compiler"
  b:str="Commuter"
  print(a != b)`,
    PyBool(true)
  );

  assert(
    "print-string-not-equals-2",
    `
  a:str="Compiler"
  b:str="Compiler"
  print(a != b)`,
    PyBool(false)
  );
});
