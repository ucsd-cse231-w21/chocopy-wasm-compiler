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
});
