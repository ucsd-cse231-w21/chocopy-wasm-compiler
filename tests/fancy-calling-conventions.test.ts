import { PyInt, PyBigInt, PyBool, PyNone, PyObj } from "../utils";
import { skipassert, assert, asserts, assertPrint, assertFail } from "./utils.test";

describe("fancy-calling-convention tests", () => {
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

  assert(
    "function-with-default-param",
    `
  def add_default_10(x : int, y : int = 10) -> int:
    return x + y`,
    PyNone()
  );

  assert(
    "class-method-with-multiple-default",
    `
  class C(object):
    def func(self : C, x : int = 3, y : int = 10)->int:
      return x + y

  c1 : C = None
  c1 = C()
  c1.func(5)
  `,
    PyInt(15)
  );

  assert(
    "class-methods-with-multiple-default",
    `
  class C(object):

    def oneDefault(self : C, input : int = 3)->int:
      return input
    
    def twoDefaults(self : C, input : int = 4, input2 : int = 5)->int:
      return input + input2

  c1 : C = None
  c1 = C()
  c1.oneDefault() + c1.twoDefaults(1)
  `,
    PyInt(9)
  );

  assert(
    "mult-class-methods-with-default",
    `
  class C(object):
    def func(self : C, input : int = 11)->int:
      return input
    
  class D(object):
    def func(self : D, input : int = 12)->int:
      return input

  c1 : C = None
  d1 : D = None
  c1 = C()
  d1 = D()
  c1.func() + d1.func()
  `,
    PyInt(23)
  );

  assert(
    "class-method-with-multiple-default1",
    `
  class C(object):

    def oneDefault(self : C, input : int = 3)->int:
      return input
    
    def twoDefaults(self : C, input : int = 4, input2 : int = 5)->int:
      return input + input2

  c1 : C = None
  x : int = 0
  c1 = C()
  x = c1.oneDefault()
  x
  `,
    PyInt(3)
  );

  assert(
    "class-methods-with-kwargs",
    `
  class C(object):
    def func(self : C, x : int, y : int)->int:
      return x - y

  c1 : C = None
  c1 = C()
  c1.func(y = 4, x = 2)
  `,
    PyInt(-2)
  );

  assertFail(
    "function-with-redefined-kwarg",
    `
  def foo(x : int, y : int) -> int:
    return x + y

  foo(x = 2, y = 4, y = 5)
    `
  );

  assertFail(
    "function-with-redefined-kwarg-and-reg-args",
    `
  def foo(z : int, x : int, y : int) -> int:
    return x + y

  foo(2, y = 4, y = 5)
    `
  );

  assertFail(
    "function-kwarg-after-positional",
    `
  def foo(z : int, x : int, y : int) -> int:
    return x + y

  foo(2, z = 4, y = 5)
    `
  );

  assertFail(
    "function-kwarg-not-enough-args",
    `
  def foo(x : int, y : int) -> int:
    return x + y

  foo(x = 4)
    `
  );

  assertFail(
    "function-kwarg-missing-param",
    `
  def foo(x : int, y : int) -> int:
    return x + y

  foo(z = 4, x = 5)
    `
  );

  assertFail(
    "function-with-out-of-order-kwarg",
    `
  def foo(x : int, y : int) -> int:
    return x + y

  foo(y = 4, 2)
    `
  );

  assert(
    "function-with-kwarg",
    `
  def foo(x : int, y : int) -> int:
    return x - y

  foo(y = 2, x = 4)
    `,
    PyInt(2)
  );

  assert(
    "function-with-kwarg-and-defaults",
    `
  def foo(x : int, y : int, z : int = 10) -> int:
    return x + 10

  foo(y = 2, x = 4)
    `,
    PyInt(14)
  );

  assert(
    "function-with-kwarg-and-multiple-defaults",
    `
  def foo(x : int = 3, y : int = 5, z : int = 10) -> int:
    return x + y - z

  foo(y = 2, z = 3, x = 4)
    `,
    PyInt(3)
  );

  assert(
    "function-kwarg-default-regular-arg",
    `
  def foo(x : int = 3, y : int = 5, z : int = 10) -> int:
    return x + y - z

  foo(2, z = 3)
    `,
    PyInt(4)
  );

  assert(
    "method-call-with-kwarg-and-defaults",
    `
  class C(object):
    def foo(Self : C, x : int, y : int, z : int = 10)->int:
      return x + 10

  c1 : C = None
  c1 = C()
  c1.foo(y = 2, x = 4)
    `,
    PyInt(14)
  );

  assert(
    "method-call-with-kwarg-and-multiple-defaults",
    `
  class C(object):
    def foo(Self : C, x : int = 3, y : int = 5, z : int = 10)->int:
      return x + y - z

  c1 : C = None
  c1 = C()
  c1.foo(y = 2, z = 3, x = 4)
    `,
    PyInt(3)
  );

  assert(
    "method-call-kwarg-default-regular-arg",
    `
  class C(object):
    def foo(Self : C, x : int = 3, y : int = 5, z : int = 10)->int:
      return x + y - z

  c1 : C = None
  c1 = C()
  c1.foo(2, z = 3)
    `,
    PyInt(4)
  );

  assert(
    "class-init-defaults",
    `
  class C(object):
    field : int = 3
    def foo(Self : C, x : int = 3, y : int = 5, z : int = 10)->int:
      return x + y - z + Self.field

  def func(c: C = C()) -> int:
    return c.foo(1, 2)
  
  func()
    `,
    PyInt(-4)
  );
});
