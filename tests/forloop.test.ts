import { PyInt, PyBool, PyNone, PyObj, LIST } from "../utils";
import { assert, asserts, assertPrint, assertTC, assertTCFail } from "./utils.test";

describe("FOR LOOP TEST", () => {
  //Programs described in the writeup, with additional changes
  //as necessary to actually test functionality
  assert(
    "for range(0)",
    `
    i:int = 0
    for i in range(5):
        print(i)
    i
    `,
    PyInt(-1)
  );

  assert(
    "for range(10)",
    `
    i:int = -1
    for i in range(10):
        print(i)
    i
    `,
    PyInt(9)
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

  assert(
    "break at 5",
    `
    i:int = -1
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
});
