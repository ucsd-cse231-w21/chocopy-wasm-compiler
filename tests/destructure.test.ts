import { expect } from "chai";
import { parse } from "../parser";
import { PyInt, PyBool, PyNone, PyObj, NUM, CLASS, BOOL } from "../utils";
import { assert, assertFail, asserts, assertTC, assertTCFail } from "./utils.test";

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

  asserts("field-assign-compile-tests", [
    [`class Tuple(object):\n  one: int = 0\n  two: bool = False`, PyNone()],
    [`t: Tuple = None\nx: Tuple = None\nx = Tuple()\nt = Tuple()`, PyNone()],
    [`t.one = 4\nt.two = True`, PyNone()],
    [`x.one, x.two = t`, PyNone()],
    [`x.one`, PyInt(4)],
    [`x.two`, PyBool(true)],
  ]);

  assert(
    "basic-compile-tests",
    `
class Tuple(object):
  one: int = 9
  two: bool = False
x: int = 0
y: bool = True
x, y = Tuple()
x`,
    PyInt(9)
  );

  asserts("march-4-test-case-1", [
    [
      `
class OtherObject(object):
  q: int = 3
class Tuple(object):
  one: int = 10
  two: bool = True
  three: OtherObject = None
x: int = 0
y: bool = False
z: OtherObject = None
t: Tuple = None
t = Tuple()
t.three = OtherObject()
x, y, z = t
    `,
      PyNone(),
    ],
    ["x", PyInt(10)],
    ["y", PyBool(true)],
    ["z is t.three", PyBool(true)],
  ]);

  assertTCFail(
    "march-4-test-case-2",
    `
class OtherObject(object):
  q: int = 3
class Tuple(object):
  one: int = 10
  two: bool = True
  three: OtherObject = None
x: int = 0
y: bool = False
z: OtherObject = None
y, z, x = Tuple()
  `
  );
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
