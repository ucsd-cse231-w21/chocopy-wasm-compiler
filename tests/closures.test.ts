import { assert, asserts } from "./utils.test";
import { PyInt, PyBool, PyNone } from "../utils";

describe("Closures group's test cases on the proposal", () => {
  {
    const src = `
    def f(x: int) -> int:
      def inc() -> int:
        return x + 1
      return inc()
    f(5)
    `;
    assert("1. Trivial nested function without escape", src, PyInt(6));
  }

  {
    const src = `
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
  }

  {
    const src = `
    def f() -> int:
      x: int = 0
      def g() -> int:
        nonlocal x
        return x + 1
      return g()
    f()
    `;
    assert("3. A trivial case where `nonlocal` can be eliminated", src, PyInt(1));
  }

  {
    const src = `
    def f(x : int)->Callable[[int],int]:
      def g(y : int) -> int:
        return x + y
      return g

    g_where_x_is_6: Callable[[int],int] = None
    g_where_x_is_6 = f(6)
    g_where_x_is_6(5)
    `;
    assert("5. Function escapes when it is returned", src, PyInt(11));
  }

  {
    const src = `
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
    assert("6. Closure with variable of object type", src, PyInt(24));
  }

  {
    const src = `
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
  }

  {
    const src = `
    def f(x : int) -> Callable[[int], bool]:
      def g(y : int) -> bool:
        return x > y
      return g

    def id(c : Callable[[int], bool]) -> Callable[[int], bool]:
      return c

    id(f(10))(5)
    `;
    assert(
      "8. An non-escaping function passed to another function as a callable argument",
      src,
      PyBool(true)
    );
  }

  {
    const src = `
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
    asserts("7. An escaping function passed to another function as a callable argument", [
      [src, PyNone()],
      ["r.fst", PyInt(5)],
      ["r.snd", PyInt(7)],
    ]);
  }

  {
    const src = `
    def f(x:int) -> Callable[[], int]:
      def g() -> int:
        return h()
      def h() -> int:
        return x + 1
      return g

    f(10)()
    `;
    assert("10. An escaping function calls its non-escaping sibling", src, PyInt(11));
  }
});
