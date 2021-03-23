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

  assertFail(
    "destructure list incorrect number of targets",
    `
      x : [int] = None
      a : int = 0
      b : int = 0
      c : int = 0

      x = [1,2]
      a,b,c = x
    `
  );

  assertFail(
    "destructure list incorrect list length",
    `
    x : [int] = None
    a : int = 0
    b : int = 0
    c : int = 0

    x = [1,2,3,4]
    a,b,c = x
  `
  );

  asserts("destructuring list basic splat operator", [
    [
      `
        a: int = 0
        b: [int] = None
        a, *b = [4, 5, 6]
        a
      `,
      PyInt(4),
    ],
    [
      `
        b[0]
      `,
      PyInt(5),
    ],
    [
      `
        b[1]
      `,
      PyInt(6),
    ],
  ]);

  asserts("destructuring list splat operator, overwrites old list reference", [
    [
      `
        a: int = 0
        b: [int] = None
        b = [1,2]
        a, *b = [4, 5, 6]
        a
      `,
      PyInt(4),
    ],
    [
      `
        b[0]
      `,
      PyInt(5),
    ],
    [
      `
        b[1]
      `,
      PyInt(6),
    ],
  ]);

  asserts("destructuring proposal test 4, Splat operator", [
    [
      `
        a: int = 0
        b: [int] = None
        _: [int] = None
        c: int = 0
        a, *b = [1, 2]
        c, *_ = [1, 2]
        a
      `,
      PyInt(1),
    ],
    [
      `
        b[0]
      `,
      PyInt(2),
    ],
    [
      `
        c
      `,
      PyInt(1),
    ],
  ]);

  asserts("destructuring proposal test 5, Empty splat operator", [
    [
      `
        a: int = 0
        b: int = 0
        c: [int] = None
        a, b, *c = [1, 2]
        a
      `,
      PyInt(1),
    ],
    [
      `
        b
      `,
      PyInt(2),
    ],
    // no way to verify c's length is 0 at the moment
  ]);

  asserts("destructuring list empty splat operator, in middle of targets", [
    [
      `
        a: int = 0
        b: int = 0
        c: [int] = None
        a, *c, b = [1, 2]
        a
      `,
      PyInt(1),
    ],
    [
      `
        b
      `,
      PyInt(2),
    ],
    // no way to verify c's length is 0 at the moment
  ]);

  asserts("destructuring proposal test 6, Single splat at any location", [
    [
      `
        a: int = 0
        c: [int] = None
        b: int = 0
        a, *c, b = [1, 2, 3]
        a
      `,
      PyInt(1),
    ],
    [
      `
        c[0]
      `,
      PyInt(2),
    ],
    [
      `
        b
      `,
      PyInt(3),
    ],
  ]);

  asserts("destructuring proposal test 7, Splat always creates a list", [
    [
      `
        _: int = 0
        b: [int] = None
        _, *b = [1, 2, 3]
        b[0]
      `,
      PyInt(2),
    ],
    [
      `
        b[1]
      `,
      PyInt(3),
    ],
  ]);

  asserts("destructuring proposal test 8, Assignment happens in a left to right order.", [
    [
      `
        x: [int] = None
        i: int = 0
        x = [0, 1]
        i, x[i] = (1, 2)
        i
      `,
      PyInt(1),
    ],
    [
      `
        x[0]
      `,
      PyInt(0),
    ],
    [
      `
        x[1]
      `,
      PyInt(2),
    ],
  ]);

  assertPrint(
    "assign to destructured variable as part of destructure",
    `
      tupel_lits: [(int, bool)] = None
      head: (int, bool) = None
      tail: (int, bool) = None
      tupel_lits = [(1, True), (2, False), (3, True), (5, False)]
      head, *tupel_lits, tail = tupel_lits
      print(head[0])
      print(head[1])
      print(tail[0])
      print(tail[1])
      print(tupel_lits[0][0])
      print(tupel_lits[0][1])
      print(tupel_lits[1][0])
      print(tupel_lits[1][1])
    `,
    ["1", "True", "5", "False", "2", "False", "3", "True"]
  );
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
    "allow type checking nested tuples",
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

  assertTC(
    "type check tuples returned from functions",
    `
      def tuple_funcle(x: int, y: int) -> (int, int):
        return (x * 2 - y, y * 2 - x)
      tuple_funcle(7, 11)
    `,
    TUPLE(NUM, NUM)
  );

  assertTC(
    "type check list of tuples",
    `
      tupel_lits: [(int, bool)] = None
      tupel_lits = [(1, True), (2, False), (3, True), (5, False)]
      tupel_lits
    `,
    LIST(TUPLE(NUM, BOOL))
  );

  assertTC(
    "tuple as object attribute",
    `
      class LinxedList(object):
        feline: bool = True
        stats: (int, int, int) = None
        next_linx: LinxedList = None
        def __init__(self: LinxedList):
          self.stats = (1, 2, 3)
      linx: LinxedList = None
      linx = LinxedList()
      linx.stats
    `,
    TUPLE(NUM, NUM, NUM)
  );

  assertTCFail(
    "assign to index of object tuple attribute",
    `
      class LinxedList(object):
        feline: bool = True
        stats: (int, int, int) = None
        next_linx: LinxedList = None
        def __init__(self: LinxedList):
          self.stats = (1, 2, 3)
      linx: LinxedList = None
      linx = LinxedList()
      linx.stats[2] = 5
    `
  );

  assertTC(
    "tuple as object method return type",
    `
      class LinxedList(object):
        feline: bool = True
        height: int = 1
        weight: int = 2
        age: int = 3
        next_linx: LinxedList = None
        def get_stats(self: LinxedList) -> (int, int, int):
          return (self.height, self.weight, self.age)
      linx: LinxedList = None
      linx = LinxedList()
      linx.get_stats()
    `,
    TUPLE(NUM, NUM, NUM)
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

  assertPrint(
    "support nested tuples",
    `
      tupel: ((bool, bool), (int, int)) = None
      tupel = ((True, False), (9, -91))
      print(tupel[0][0])
      print(tupel[0][1])
      print(tupel[1][0])
      print(tupel[1][1])
    `,
    ["True", "False", "9", "-91"]
  );

  assertPrint(
    "supports nested object tuples",
    `
      class Ghost(object):
         boo: str = "boo"
      class FakeGhost(object):
         boo: str = "oob"
      ghost: Ghost = None
      fake_ghost: FakeGhost = None
      ghostly: ((Ghost, FakeGhost, Ghost), Ghost, (FakeGhost, FakeGhost)) = None
      ghost = Ghost()
      ghost.boo = "boooooo"
      fake_ghost = FakeGhost()
      fake_ghost.boo = "ooooooob"
      ghostly = ((Ghost(), FakeGhost(), ghost), None, (fake_ghost, FakeGhost()))
      print(ghostly[0][0].boo)
      print(ghostly[2][1].boo)
      print(ghostly[0][2].boo)
      print(ghostly[0][2] is ghost)
      print(ghostly[2][0].boo)
      print(ghostly[2][0] is fake_ghost)
      print(ghostly[2][1] is fake_ghost)
      print(ghostly[1] is None)
    `,
    ["boo", "oob", "boooooo", "True", "ooooooob", "True", "False", "True"]
  );

  assert(
    "can return boolean tuple from a function",
    `
      def bool_toopl(x: bool, y: bool) -> (bool, bool):
        return (not (not x) and (not y), not (not x) or (not y))
      bool_toopl(True, False)[0]
    `,
    PyBool(true)
  );

  assertPrint(
    "can return tuple from a function",
    `
      def tuple_funcle(x: int, y: int) -> (int, int):
        return (x * 2 - y, y * 2 - x)
      tupel: (int, int) = None
      tupel = tuple_funcle(7, 11)
      print(tupel[0])
      print(tupel[1])
    `,
    ["3", "15"]
  );

  assertPrint(
    "can pass tuples as arguments into functions",
    `
      def scrambled_tuples(t1: (int, bool), t2: (int, bool)) -> (int, int):
        x_i: int = 0
        x_b: bool = False
        y_i: int = 0
        y_b: bool = False
        z_x: int = 0
        z_y: int = 0
        x_i, x_b = t1
        y_i, y_b = t2
        if x_b:
          z_x = x_i
        else:
          z_x = -x_i
        if y_b:
          z_y = y_i
        else:
          z_y = -y_i
        return (z_y, z_x)
      res: (int, int) = None
      res = scrambled_tuples((5, False), (10, True))
      print(res[0])
      print(res[1])
    `,
    ["10", "-5"]
  );

  assertPrint(
    "access tuples in list",
    `
      tupel_lits: [(int, bool)] = None
      tupel_lits = [(1, True), (2, False), (3, False), (5, True)]
      print(tupel_lits[0][0])
      print(tupel_lits[1][1])
      print(tupel_lits[2][0])
      print(tupel_lits[3][1])
    `,
    ["1", "False", "3", "True"]
  );

  assertPrint(
    "tuple as object attribute",
    `
      class LinxedList(object):
        feline: bool = True
        stats: (int, int, int) = None
        next_linx: LinxedList = None
        def __init__(self: LinxedList):
          self.stats = (1, 2, 3)
      linx: LinxedList = None
      linx = LinxedList()
      print(linx.stats[0])
      print(linx.stats[1])
      print(linx.stats[2])
      linx.stats = (10, 100, 1000)
      print(linx.stats[2])
      print(linx.stats[0])
      print(linx.stats[1])
    `,
    ["1", "2", "3", "1000", "10", "100"]
  );

  assertPrint(
    "tuple as object method return type",
    `
      class LinxedList(object):
        feline: bool = True
        height: int = 1
        weight: int = 2
        age: int = 3
        next_linx: LinxedList = None
        def get_stats(self: LinxedList) -> (int, int, int):
          return (self.height, self.weight, self.age)
      linx: LinxedList = None
      stats: (int, int, int) = None
      linx = LinxedList()
      stats = linx.get_stats()
      linx.height = 500
      linx.weight = 5000
      linx.age = 50000
      print(stats[0])
      print(stats[2])
      print(stats[1])
      stats = linx.get_stats()
      print(stats[1])
      print(stats[0])
      print(stats[2])
    `,
    ["1", "3", "2", "5000", "500", "50000"]
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

  assertTC(
    "TC destructure tuples with starred assignment, single length list",
    `
      t : (int, int, int) = None
      a : int = 0
      b : [int] = None
      c : int = 0
      t = (1,2,3)
      a, *b, c = t
      b
    `,
    LIST(NUM)
  );

  assertTC(
    "TC destructure tuples with starred assignment, multiple length list",
    `
    t : (int, int, int) = None
    a : int = 0
    b : [int] = None
    t = (1,2,3)
    a, *b = t
    b
  `,
    LIST(NUM)
  );

  assertTC(
    "TC destructure tuples with starred at head",
    `
    t : (int, int, int) = None
    a : int = 0
    b : [int] = None
    t = (1,2,3)
    *b, a = t
    b
  `,
    LIST(NUM)
  );

  assertTCFail(
    "TC destructure tuples with starred assignment, incorrect typed list",
    `
    t : (int, int, bool) = None
    a : int = 0
    b : [int] = None
    t = (1,2,True)
    a, *b = t
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
        fileId: 1,
        col: 1,
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
                fileId: 1,
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
          fileId: 1,
          col: 1,
          length: 1,
          line: 1,
        },
      },
      tag: "assignment",
      value: {
        a: {
          fileId: 1,
          col: 5,
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
        fileId: 1,
        col: 1,
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
                fileId: 1,
                col: 2,
                length: 1,
                line: 1,
              },
              name: "y",
              tag: "id",
            },
          },
        ],
        valueType: {
          fileId: 1,
          col: 1,
          length: 1,
          line: 1,
        },
      },
      tag: "assignment",
      value: {
        a: {
          fileId: 1,
          col: 7,
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
        fileId: 1,
        col: 1,
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
                fileId: 1,
                col: 1,
                length: 3,
                line: 1,
              },
              tag: "lookup",
              field: "x",
              obj: {
                a: {
                  fileId: 1,
                  col: 1,
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
                fileId: 1,
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
          fileId: 1,
          col: 1,
          length: 3,
          line: 1,
        },
      },
      tag: "assignment",
      value: {
        a: {
          fileId: 1,
          col: 10,
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
        fileId: 1,
        col: 1,
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
                fileId: 1,
                col: 1,
                length: 4,
                line: 1,
              },
              tag: "bracket-lookup",
              obj: {
                a: {
                  fileId: 1,
                  col: 1,
                  length: 1,
                  line: 1,
                },
                tag: "id",
                name: "d",
              },
              key: {
                a: {
                  fileId: 1,
                  col: 3,
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
                fileId: 1,
                col: 7,
                length: 1,
                line: 1,
              },
              name: "y",
              tag: "id",
            },
          },
        ],
        valueType: {
          fileId: 1,
          col: 1,
          length: 4,
          line: 1,
        },
      },
      tag: "assignment",
      value: {
        a: {
          fileId: 1,
          col: 11,
          length: 1,
          line: 1,
        },
        name: "z",
        tag: "id",
      },
    });
  });
});
