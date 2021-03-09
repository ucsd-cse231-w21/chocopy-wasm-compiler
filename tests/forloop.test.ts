import { PyInt, PyBool, PyNone, PyObj, LIST } from "../utils";
import { assert, asserts, assertPrint, assertTC, assertTCFail } from "./utils.test";

describe("FOR LOOP TEST", () => {
  //Programs described in the writeup, with additional changes
  //as necessary to actually test functionality
  assert(
    "for range(5)",
    `
    i:int = 0
    for i in range(5):
        print(i)
    i
    `,
    PyInt(4)
  );

  assert(
    "for range(10)",
    `
    i:int = 0
    for i in range(10):
        print(i)
    i
    `,
    PyInt(9)
  );

  assert(
    "for range(1, 10, 1)",
    `
    i:int = 0
    x:int = 0
    for i in range(1, 10, 1):
      x = x + 1
    x
    `,
    PyInt(9)
  );

  assert(
    "for range(1, 10, 2)",
    `
    i:int = 0
    x:int = 0
    for i in range(1, 10, 2):
      x = x + 1
    x
    `,
    PyInt(5)
  );

  assertTCFail(
    "break outside loop",
    `
    i:int = 0
    break
    for i in range(5):
        print(i)
    `
  );

  assertTCFail(
    "continue outside loop",
    `
    i:int = 0
    continue
    for i in range(5):
        print(i)
    `
  );

  assert(
    "break at 5",
    `
    i:int = 0
    for i in range(10):
        print(i)
        if i == 5:
            break
        else:
            pass
    i
    `,
    PyInt(5)
  );

  assert(
    "continue at 5",
    `
    i:int = 0
    x:int = 0
    for i in range(6):
        if i == 5:
            continue
            i = 5
        else:
            pass
    x
    `,
    PyInt(0)
  );
});
