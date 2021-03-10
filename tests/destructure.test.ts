import { expect } from "chai";
import { parse } from "../parser";
import { PyInt, PyBool, PyNone, PyObj, NUM, CLASS, BOOL, LIST, TUPLE, PyValue } from "../utils";
import { assert, assertFail, assertPrint, asserts, assertTC, assertTCFail } from "./utils.test";

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

describe("Destructure lists", () => {
  assertTC(
    "TC destructure list to ids",
    `
      listy: [int] = None
      a: int = 0
      b: int = 0
      c: int = 0
      d: int = 0
      listy = [1, 3, 4, 7]
      a, b, c, d = listy
      c
    `,
    NUM
  );

  assertTC(
    "TC destructure list to lookups",
    `
      class BoolContainer(object):
        a: bool = False
        b: bool = True
        c: bool = False
        d: bool = False
      listy: [bool] = None
      bc: BoolContainer = None
      listy = [True, False, False, True]
      bc = BoolContainer()
      bc.a, bc.b, bc.c, bc.d = listy
      bc.d
    `,
    BOOL
  );

  assertTC(
    "TC destructure list to bracket-lookups",
    `
      listy: [int] = None
      listy = [1, 4, 5, 9]
      listy[0], listy[1], listy[2], listy[3] = listy
      listy[1]
    `,
    NUM
  );

  assertTC(
    "TC destructure list with starred assignment",
    `
      list_parent: [bool] = None
      list_child: [bool] = None
      booly: bool = False
      list_parent = [False, True, False, True]
      booly, *list_child, booly = list_parent
      list_child
    `,
    LIST(BOOL)
  );

  asserts("destructure list to ids", [
    [
      `
        listy: [int] = None
        a: int = 0
        b: int = 0
        c: int = 0
        d: int = 0
        listy = [1, 3, 4, 7]
        a, b, c, d = listy
        a
      `,
      PyInt(1),
    ],
    [
      `
          b
        `,
      PyInt(3),
    ],
    [
      `
          c
        `,
      PyInt(4),
    ],
    [
      `
          d
        `,
      PyInt(7),
    ],
  ]);

  asserts("destructure list to lookups", [
    [
      `
        class BoolContainer(object):
          a: bool = False
          b: bool = True
          c: bool = False
          d: bool = False
        listy: [bool] = None
        bc: BoolContainer = None
        listy = [True, False, False, True]
        bc = BoolContainer()
        bc.a, bc.b, bc.c, bc.d = listy
        bc.a
      `,
      PyBool(true),
    ],
    [
      `
        bc.b
      `,
      PyBool(false),
    ],
    [
      `
        bc.c
      `,
      PyBool(false),
    ],
    [
      `
        bc.d
      `,
      PyBool(true),
    ],
  ]);
});

describe("General tuple tests", () => {
  assertTC("tuple literal type test", "(1, 2, True, False)", TUPLE(NUM, NUM, BOOL, BOOL));

  assertTC(
    "tuple variable type test",
    `
      tupel: (bool, int, bool) = None
      tupel = (True, 24, False)
      tupel
    `,
    TUPLE(BOOL, NUM, BOOL)
  );

  assertTCFail(
    "tuple variable assigned incorrect tuple type (item mismatch)",
    `
      tupel: (bool, bool, int) = None
      tupel = (True, False, True)
    `
  );

  assertTCFail(
    "tuple variable assigned incorrect tuple type (too many items)",
    `
      tupel: (bool, bool) = None
      tupel = (False, False, False)
    `
  );

  assertTCFail(
    "tuple variable assigned incorrect tuple type (too few items)",
    `
      tupel: (int, bool, int, int) = None
      tupel = (19, False, 20)
    `
  );

  assertTC(
    "tuple indexing returns correct type",
    `
      tupel: (int, bool) = None
      tupel = (17, False)
      tupel[1]
    `,
    BOOL
  );

  assertTCFail(
    "tuple indexing does not support non-numbers",
    `
      tupel: (int, int, int) = None
      tupel = (5, 10, 20)
      tupel[True]
    `
  );

  assertTCFail(
    "tuple indexing does not support non-literal numbers",
    `
      tupel: (bool) = None
      index: int = 0
      tupel = (True,)
      tupel[index]
    `
  );

  assertTCFail(
    "tuple indexing does not support indexing past size of tuple",
    `
      tupel: (int, int) = None
      tupel = (100, -100)
      tupel[2]
    `
  );

  assertTCFail(
    "tuple indexing does not support assignment",
    `
      tupel: (bool, bool) = None
      tupel = (True, False)
      tupel[1] = True
    `
  );

  assertTC(
    "allow nested tuples",
    `
      tupel: ((bool, bool), (int, int)) = None
      tupel = ((True, False), (9, -91))
      tupel[1]
    `,
    TUPLE(NUM, NUM)
  );

  assertTC(
    "allow chained indexing on nested tuples",
    `
      tupel: ((int, bool), (int, bool)) = None
      tupel = ((-11, True), (-111, False))
      tupel[0][1]
    `,
    BOOL
  );

  assertPrint(
    "tuple indexing produces the right values",
    `
      tupel: (int, bool, int, bool, int) = None
      tupel = (1, True, 3, False, 8)
      print(tupel[0])
      print(tupel[1])
      print(tupel[2])
      print(tupel[3])
      print(tupel[4])
      print((True,)[0])
      print((5, 6, 11, 17, 28, 45)[4])
    `,
    ["1", "True", "3", "False", "8", "True", "28"]
  );

  assertPrint(
    "supports object tuples",
    `
      class Ghost(object):
         boo: str = "boo"
      ghost: Ghost = None
      ghostly: (Ghost, Ghost) = None
      ghost = Ghost()
      ghostly = (None, ghost)
      print(ghostly[1].boo)
      print(ghostly[1] is ghost)
    `,
    ["boo", "True"]
  );
});

describe("Destructure tuples", () => {
  asserts("destructuring proposal test 1, support destructuring tuples", [
    [
      `
          a: int = 0
          b: bool = False
          t: (int, bool) = None
          t = (1, True)
          a, b = t
          a
        `,
      PyInt(1),
    ],
    [
      `
          b
        `,
      PyBool(true),
    ],
  ]);

  assert(
    "destructuring proposal test 2, support single element tuples",
    `
      a: int = 0
      a, = (1,)
      a
    `,
    PyInt(1)
  );

  asserts("destructuring proposal test 12, support object field assignment", [
    [
      `
          class Test(object):
            a: int = 0
            b: int = 0
          t: Test = None
          t = Test()
          t.a, t.b = (5, 6)
          t.a
        `,
      PyInt(5),
    ],
    [
      `
          t.b
        `,
      PyInt(6),
    ],
  ]);

  assertPrint(
    "swaps two variables using tuples",
    `
      class Sky(object):
        color: int = 135206255
      good_sky: Sky = None
      bad_sky: Sky = None
      s1: Sky = None
      s2: Sky = None
      good_sky = Sky()
      bad_sky = Sky()
      bad_sky.color = 139000000
      s1 = good_sky
      s2 = bad_sky
      print(s1 is good_sky)
      print(s2 is bad_sky)
      s1, s2 = (s2, s1)
      print(s1 is bad_sky)
      print(s2 is good_sky)
    `,
    ["True", "True", "True", "True"]
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
