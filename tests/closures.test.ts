import { assert } from "./utils.test";
import { PyInt, PyBool, PyNone } from "../utils";

describe("Closures", () => {
  let src: string;
  src = 
  `
  def f(x: int) -> int:
    def inc() -> int:
      return x + 1
    return inc()
  f(5)
  `;
  assert("1: A trivial nested function without escape", src, PyInt(6));

  src = 
  `
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
  assert("2: A trivial `nonlocal` usage", src, PyInt(35));

  src =
  `
  def f() -> int:
    x: int = 0
    def g() -> int:
      nonlocal x
      return x + 1
    return g()
  f()
  `
  assert("3: A trivial case where `nonlocal` can be eliminated", src, PyInt(1));

  src =
  `
  def f(x : int)->Callable[[int], int]:
    def g(y : int) -> int:
      return x + y
    return g

  g_where_x_is_6: Callable[[int], int] = None
  g_where_x_is_6 = f(6)
  print(g_where_x_is_6(5))
  `
  assert("5: A trivial escaped function", src, PyInt(11));

  src =
  `
  class A(object):
    a: int = 1

  def f(a: A) -> Callable[[int], int]:
    def g(y: int) -> int:
      a.a = a.a + y
      return a.a
    return g

  a: A = None
  g: Callable[[int], int] = None
  a = A()
  a.a = 6
  g = f(a)
  a.a = 10
  g(2) + a.a
  `
  assert("6: Closure with a variable of object type", src, PyInt(24));

  src =
  `
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

  tuple: Triplet = None
  tuple = foo()
  tuple.fst()
  `
  assert("7: Multiple escaped closures", src, PyInt(101))

  src =
  `
  def f(x: int) -> Callable[[int], bool]:
    def g(y: int) -> bool:
      return x > y
    return g

  def id(c : Callable[[int], bool]) -> Callable[[int], bool]:
    return c

  id(f(10))(5)
  `
  assert("8: Chained `call_expr`", src, PyBool(true));

  src =
  `
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
  r.fst
  r.snd
  `
  assert("9: A case of callable type arguments", src, PyInt(7));

  src =
  `
  def f(x:int) -> Callable[[], int]:
    def g() -> int:
      return h()
    def h() -> int:
      return x + 1
    return g

  f(10)()
  `
  assert("10: Indirect escape", src, PyInt(11));
});
