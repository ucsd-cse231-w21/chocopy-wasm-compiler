import { expect } from "chai";
import { PyInt, PyBool, PyNone, PyObj, NUM, CLASS, BOOL } from "../utils";
import { importObject } from "./import-object.test";
import { Value, Location } from "../ast";
import { BasicREPL } from "../repl";
import { MemoryManager } from "../alloc";

export function assertUsage(
  name: string,
  source: string,
  expected: Value | undefined,
  postUsage: bigint
) {
  it(name, async () => {
    const repl = new BasicREPL(importObject);
    const manager = repl.memoryManager;
    expect(Number(manager.heapMemoryUsage())).to.equal(0);
    const result = await repl.run(source);
    if (expected) {
      expect(result).to.deep.eq(expected);
    }
    manager.forceCollect();
    expect(Number(manager.heapMemoryUsage())).to.equal(Number(postUsage));
  });
}

export function assertsUsage(name: string, pairs: Array<[string, Value, BigInt]>) {
  const repl = new BasicREPL(importObject);
  const manager = repl.memoryManager;

  it(name, async () => {
    for (let i = 0; i < pairs.length; i++) {
      if (i === 0) {
        expect(Number(manager.heapMemoryUsage())).to.equal(0);
      }
      const result = await repl.run(pairs[i][0]);
      expect(result).to.deep.eq(pairs[i][1]);
      manager.forceCollect();
      expect(Number(manager.heapMemoryUsage())).to.equal(Number(pairs[i][2]));
    }
  });
}

describe("GC-MnS Integration Tests", () => {
  assertUsage("Program 1", "2 + 3", PyInt(2 + 3), 0n);

  assertUsage(
    "Program 2",
    `class Foo(object):
     a: int = 0
     b: int = 0

   x: Foo = None
   x = Foo()
   x.a = 1337

   x = Foo()
   x.a = 21
   x.a`,
    PyInt(21),
    8n
  );

  assertUsage(
    "Program 3",
    `class DList(object):
     prev: DList = None
     next: DList = None
     v: int = 0

   d0: DList = None
   d1: DList = None
   d2: DList = None

   d0 = DList()
   d1 = DList()
   d2 = DList()

   d0.prev = d2
   d0.next = d1

   d1.prev = d0
   d1.next = d2

   d2.prev = d1
   d2.next = d0`,
    PyNone(),
    36n
  );

  assertUsage(
    "Program 4",
    `class DList(object):
     prev: DList = None
     next: DList = None
     v: int = 0

   def test():
     d0: DList = None
     d1: DList = None
     d2: DList = None

     d0 = DList()
     d1 = DList()
     d2 = DList()

     d0.prev = d2
     d0.next = d1

     d1.prev = d0
     d1.next = d2

     d2.prev = d1
     d2.next = d0

   test()`,
    PyNone(),
    0n
  );

  assertUsage(
    "Program 5",
    `
    class Foo(object):
      a: int = 0
      f: Foo = None

    x: Foo = None
    x = Foo()
    x.a = 1337
    x.f = Foo()

    x = Foo()
    x.a = 21
    x.a`,
    PyInt(21),
    8n
  );

  assertsUsage("Program 6", [
    [
      `
      class Foo(object):
        f: Foo = None

      x: Foo = None
      x = Foo()
      x.f = Foo()`,
      PyNone(),
      8n,
    ],
    ["x = None", PyNone(), 0n],
  ]);

  assertsUsage("Program 7", [
    [
      `

      class Foo(object):
        a: int = 0
        f: Foo = None

      x: [Foo] = None
      f: Foo = None
      f = Foo()
      f.f = Foo()

      x = [None, None, f]`,
      PyNone(),
      // Taken from "list-expr" codegen in compiler.ts
      //   alloc size: (listBound + 3) * 4
      // +16 for the two Foo's
      16n + ((3n + 10n) * 2n + 3n) * 4n,
    ],
    ["x = None", PyNone(), 16n],
  ]);

  assertsUsage("Program 8", [
    [
      `
      def f(x: int) -> Callable[[],int]:
        def inc() -> int:
          nonlocal x
          x = x + 1
          return x

        return inc

      i: Callable[[], int] = None
      i = f(0)
      i()
      i()`,
      PyInt(2),
      12n,
    ],
    [`i = None`, PyNone(), 0n],
  ]);

  assertsUsage("Program 9", [
    [
      `
      class Foo(object):
        a: int = 0

      def f(x: int) -> Foo:
        f: Foo = None
        f = Foo()
        f.a = x
        return f

      o: Foo = None
      o = f(1337)`,
      PyNone(),
      4n,
    ],
    [`o = f(0)`, PyNone(), 4n],
  ]);

  assertUsage(
    "Program 10",
    `
    class Foo():
      a: int = 0

    def wasteTime() -> Foo:
      x: int = 0
      f: Foo = None
      r: Foo = None

      while x < 1000:
        f = Foo()
        f.a = x
        if x < 100:
          r = Foo()
          r.a = x
        else:
          pass
        x = x + 1

      return r

    y: Foo = None
    y = wasteTime()
    y.a
    `,
    PyInt(99),
    4n
  );

  assertsUsage("Dictionary", [
    [
      `
      d: [int, int] = None
      d = {3:4}
      `,
      PyNone(),
      52n,
    ],
    ["d[3]", PyInt(4), 52n],
    ["d[9] = 19", PyNone(), 64n],
    ["d[9]", PyInt(19), 64n],
    ["d[13] = 1337", PyNone(), 76n],
    ["d[13]", PyInt(1337), 76n],
  ]);
});
