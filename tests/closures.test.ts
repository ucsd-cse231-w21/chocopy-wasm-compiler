import { assert, assertPrint, asserts, assertFail } from "./utils.test";
import { PyInt, PyBool, PyNone, PyString } from "../utils";

describe("Test cases from closures group", () => {
  let src;
  src = `
  def f(x: int) -> int:
    def inc() -> int:
      return x + 1
    return inc()
  f(5)
  `;
  assert("1. Trivial nested function without escape", src, PyInt(6));

  src = `
  def f(x : int) -> int:
    def g(y : int) -> int:
      return x + h(y)
    def h(z : int) -> int:
      nonlocal x
      x = z
      return x + 1
    return g(10) + g(7)
  f(6)
  `;
  assert("2. Trivial `nonlocal` usage", src, PyInt(35));

  src = `
  def f() -> int:
    x: int = 0
    def g() -> int:
      nonlocal x
      return x + 1
    return g()
  f()
  `;
  assert("3. A trivial case where `nonlocal` can be eliminated", src, PyInt(1));

  src = `
  def f(x : int)->Callable[[int],int]:
    def g(y : int) -> int:
      return x + y
    return g

  g_where_x_is_6: Callable[[int],int] = None
  g_where_x_is_6 = f(6)
  g_where_x_is_6(5)
  `;
  assert("5. A function escapes when it is returned", src, PyInt(11));

  src = `
  class A(object):
    x:int = 1

  def f(a:A)->Callable[[int],int]:
    def g(y: int) -> int:
      a.x = a.x + y
      return a.x
    return g

  a:A = None
  g: Callable[[int], int] = None
  a = A()
  a.x = 6
  g = f(a)
  a.x = 10
  g(2) + a.x
  `;
  assert("6. A closure with a variable of object type", src, PyInt(24));

  src = `
  class Triplet(object):
    fst:Callable[[], int] = None
    snd:Callable[[], int] = None
    thd:Callable[[], int] = None

  def foo() -> Triplet:
    x: int = 0
    r: Triplet = None
    def inc() -> int:
      nonlocal x
      x = x + 1
      return x
    def dec() -> int:
      nonlocal x
      x = x -1
      return x
    def curr() -> int:
      return x
    r = Triplet()
    x = 100
    r.fst = inc
    r.snd = dec
    r.thd = curr
    return r

  r: Triplet = None
  r = foo()
  `;
  asserts("7. A modified example from Feb 9 lecture (nonlocal, inc/dec)", [
    [src, PyNone()],
    ["r.fst()", PyInt(101)],
    ["r.snd()", PyInt(100)],
    ["r.fst()", PyInt(101)],
    ["r.thd()", PyInt(101)],
  ]);

  src = `
  def f(x : int) -> Callable[[int], bool]:
    def g(y : int) -> bool:
      return x > y
    return g

  def id(c : Callable[[int], bool]) -> Callable[[int], bool]:
    return c

  id(f(10))(5)
  `;
  assert("8. An non-escaping function passed to another function as a callable argument",
    src,
    PyBool(true)
  );

  src = `
  class MyTupleInt(object):
    fst: int = 0
    snd: int = 0

  def add_n(x:int) -> Callable[[int], int]:
    def g(y:int)-> int:
      return x + y
    return g

  def map2(x: int, y: int, f: Callable[[int], int])-> MyTupleInt:
    t: MyTupleInt = None
    t = MyTupleInt()
    t.fst = f(x)
    t.snd = f(y)
    return t

  add_2: Callable[[int], int] = None
  r: MyTupleInt = None

  add_2 = add_n(2)
  r = map2(3, 5, add_2)
  `;
  asserts("9. An escaping function passed to another function as a callable argument", 
  [
    [src, PyNone()],
    ["r.fst", PyInt(5)],
    ["r.snd", PyInt(7)],
  ]);

  src = `
  def f(x:int) -> Callable[[], int]:
    def g() -> int:
      return h()
    def h() -> int:
      return x + 1
    return g

  f(10)()
  `;
  assert("10. An escaping function calls its non-escaping sibling", src, PyInt(11));

  src = `
  def concat(items: [bool], stuff: [bool]) -> [bool]:
    concatted : [bool] = None
    concatted = items + stuff
    return concatted

  items : [bool] = None
  stuff : [bool] = None
  concatted : [bool] = None
  items = [True, True, False]
  stuff = [False, True]
  concatted = concat(items, stuff)
`;
  asserts("11. A function with list created", [
    [src, PyNone()],
    ["concatted[0]", PyBool(true)],
    ["concatted[1]", PyBool(true)],
    ["concatted[2]", PyBool(false)],
    ["concatted[3]", PyBool(false)],
    ["concatted[4]", PyBool(true)],
  ]);

  src = `
  def f(x: [int]) -> [int]:
    def inc() -> [int]:
      return x + [1]
    return inc()
  x : [int] = None
  x = f(x)
  x = f(x)
  x = f(1)
  `;
  asserts("12. A nested function with list created", [
    [src, PyNone()],
    ["x[0]", PyInt(1)],
    ["x[1]", PyInt(1)],
    ["x[2]", PyInt(1)],
  ]);

  src = `
  def f(x : [int]) -> [int]:
    def g(y : [int]) -> [int]:
      return x + h(y)
    def h(z : [int]) -> [int]:
      nonlocal x
      x = z
      return x + [1]
  return g([10]) + g([7])

  x: [int] = None
  x = f([6])
  `;
  asserts("13. A nested function with `nonlocal` and list created", [
    // [6, 10, 1, 10, 7, 1]
    [src, PyNone()],
    ["x[0]", PyInt(6)],
    ["x[1]", PyInt(10)],
    ["x[2]", PyInt(1)],
    ["x[3]", PyInt(10)],
    ["x[4]", PyInt(7)],
    ["x[5]", PyInt(1)],
  ]);

  src = `
  def f(x : string) -> string:
    def g(y : string) -> string:
      return x + h(y)
    def h(z : string) -> string:
      nonlocal x
      x = z
      return x + "1"
  return g("10") + g("7")

  x: string = None
  x = f("6")
  print(x)
`;
  assertPrint("14. A nested function with `nonlocal` and string ", src, ["61011071"]);

  src = `
  def f(x:int):
    print(x)
  g:Callable[[int], ] = None
  g = f
  g()
  `
  assertFail("15. Invalid number of arguments to call a function value", src);

  src = `
  def f(x:bool):
    print(x)
  g:Callable[[int], ] = None
  g = f
  g(0)
  `
  assertFail("16. Invalid type of argument to call a function value", src);

  src = `
  def f(x:int, y:int):
    print(x)
    print(y)
  g:Callable[[int, int], ] = None
  g = f
  g(0, 1)
  `
  assert("17-1. Multiple arguments", src, PyNone());
  assertPrint("17-2. Multiple arguments", src, ["0", "1"]);
});
