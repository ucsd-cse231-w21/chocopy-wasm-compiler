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

  assert(
    "destruct-with-dict",
    `
class Tuple(object):
  one: int = 9
  two: bool = False
d:[int, int] = None
y: bool = True
d = {1:2}
d[1], y = Tuple()
d[1]`,
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
      a: {
        col: 0,
        length: 5,
        line: 1,
      },
      destruct: {
        isDestructured: false,
        targets: [
          {
            ignore: false,
            starred: false,
            target: {
              a: {
                col: 0,
                length: 1,
                line: 1,
              },
              name: "y",
              tag: "id",
            },
          },
        ],
        valueType: {
          col: 0,
          length: 1,
          line: 1,
        },
      },
      tag: "assignment",
      value: {
        a: {
          col: 4,
          length: 1,
          line: 1,
        },
        name: "z",
        tag: "id",
      },
    });
  });

  it("*y, = z is valid (starred in destructure)", () => {
    const assign = parse("*y, = z").stmts[0];
    expect(assign).to.eql({
      a: {
        col: 0,
        length: 7,
        line: 1,
      },
      destruct: {
        isDestructured: true,
        targets: [
          {
            ignore: false,
            starred: true,
            target: {
              a: {
                col: 1,
                length: 1,
                line: 1,
              },
              name: "y",
              tag: "id",
            },
          },
        ],
        valueType: {
          col: 0,
          length: 1,
          line: 1,
        },
      },
      tag: "assignment",
      value: {
        a: {
          col: 6,
          length: 1,
          line: 1,
        },
        name: "z",
        tag: "id",
      },
    });
  });

  it("allows fields in assignment", () => {
    const assign = parse("c.x, y = z").stmts[0];
    expect(assign).to.eql({
      a: {
        col: 0,
        length: 10,
        line: 1,
      },
      destruct: {
        isDestructured: true,
        targets: [
          {
            ignore: false,
            starred: false,
            target: {
              a: {
                col: 0,
                length: 3,
                line: 1,
              },
              tag: "lookup",
              field: "x",
              obj: {
                a: {
                  col: 0,
                  length: 1,
                  line: 1,
                },
                name: "c",
                tag: "id",
              },
            },
          },
          {
            ignore: false,
            starred: false,
            target: {
              a: {
                col: 5,
                length: 1,
                line: 1,
              },
              name: "y",
              tag: "id",
            },
          },
        ],
        valueType: {
          col: 0,
          length: 3,
          line: 1,
        },
      },
      tag: "assignment",
      value: {
        a: {
          col: 9,
          length: 1,
          line: 1,
        },
        name: "z",
        tag: "id",
      },
    });
  });

  it("allows fields in assignment2", () => {
    const assign = parse("d[2], y = z").stmts[0];
    expect(assign).to.eql({
      a: {
        col: 0,
        length: 11,
        line: 1,
      },
      destruct: {
        isDestructured: true,
        targets: [
          {
            ignore: false,
            starred: false,
            target: {
              a: {
                col: 0,
                length: 4,
                line: 1,
              },
              tag: "bracket-lookup",
              obj: {
                a: {
                  col: 0,
                  length: 1,
                  line: 1,
                },
                tag: "id",
                name: "d",
              },
              key: {
                a: {
                  col: 2,
                  length: 1,
                  line: 1,
                },
                tag: "literal",
                value: { tag: "num", value: 2n },
              },
            },
          },
          {
            ignore: false,
            starred: false,
            target: {
              a: {
                col: 6,
                length: 1,
                line: 1,
              },
              name: "y",
              tag: "id",
            },
          },
        ],
        valueType: {
          col: 0,
          length: 4,
          line: 1,
        },
      },
      tag: "assignment",
      value: {
        a: {
          col: 10,
          length: 1,
          line: 1,
        },
        name: "z",
        tag: "id",
      },
    });
  });
});
