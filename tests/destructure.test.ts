import { expect } from "chai";
import { parse } from "../parser";
import { PyInt, PyBool, PyNone, PyObj, NUM, CLASS, BOOL } from "../utils";
import { asserts, assertTC, assertTCFail } from "./utils.test";

describe("Destructure integration (class based. to be converted to tuples)", () => {
  // NOTE: Assigning from class fields is a temporary measure
  assertTC(
    "basic-assign",
    `
class Tuple(object):
  one: int = 0
x: Tuple = None
x = Tuple()
x`,
    CLASS("Tuple")
  );

  assertTC(
    "single-unpack",
    `
class Tuple(object):
  one: int = 0
x: int = 0
x, = Tuple()
x`,
    NUM
  );

  assertTC(
    "multiple-unpack",
    `
class Tuple(object):
  one: int = 0
  two: bool = False
x: int = 0
y: bool = True
x, y = Tuple()
x`,
    NUM
  );

  assertTCFail(
    "not-enough-targets",
    `
class Tuple(object):
  one: int = 0
  two: bool = False
x: int = 0
y: bool = True
x, = Tuple()`
  );

  assertTCFail(
    "too-many-targets",
    `
class Tuple(object):
  one: int = 0
  two: bool = False
x: int = 0
y: bool = True
x, y, x = Tuple()`
  );

  assertTCFail(
    "incorrect-targets",
    `
class Tuple(object):
  one: int = 0
  two: bool = False
x: int = 0
y: bool = True
y, x = Tuple()`
  );

  // FIXME: feature to work on. Enable with compilers code
  // asserts("basic-compile-tests", [
  //   [`class Tuple(object):\n  one: int = 0\n  two: bool = False`, PyNone()],
  //   [`t: Tuple = None\nx: Tuple = None\nx = Tuple()\nt = Tuple()`, PyNone()],
  //   [`t.one = 4\nt.two = True`, PyNone()],
  //   [`x.one, x.two = t`, PyNone()],
  //   [`x.one`, PyInt(4)],
  //   [`x.two`, PyBool(true)],
  // ]);
});

describe("traverseDestructure()", () => {
  it("*y = z is invalid (starred not in destructure)", () => {
    expect(() => parse("*y = z")).to.throw();
  });

  it("parses non-destructred assignment", () => {
    const assign = parse("y = z").stmts[0];
    expect(assign).to.eql({
      destruct: {
        isDestructured: false,
        targets: [
          {
            ignore: false,
            starred: false,
            target: {
              name: "y",
              tag: "id",
            },
          },
        ],
      },
      tag: "assignment",
      value: {
        name: "z",
        tag: "id",
      },
    });
  });

  it("*y, = z is valid (starred in destructure)", () => {
    const assign = parse("*y, = z").stmts[0];
    expect(assign).to.eql({
      destruct: {
        isDestructured: true,
        targets: [
          {
            ignore: false,
            starred: true,
            target: {
              name: "y",
              tag: "id",
            },
          },
        ],
      },
      tag: "assignment",
      value: {
        name: "z",
        tag: "id",
      },
    });
  });

  it("allows fields in assignment", () => {
    const assign = parse("c.x, y = z").stmts[0];
    expect(assign).to.eql({
      destruct: {
        isDestructured: true,
        targets: [
          {
            ignore: false,
            starred: false,
            target: {
              tag: "lookup",
              field: "x",
              obj: {
                name: "c",
                tag: "id",
              },
            },
          },
          {
            ignore: false,
            starred: false,
            target: {
              name: "y",
              tag: "id",
            },
          },
        ],
      },
      tag: "assignment",
      value: {
        name: "z",
        tag: "id",
      },
    });
  });
});
