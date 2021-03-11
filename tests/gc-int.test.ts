import { expect } from "chai";
import { PyInt, PyBool, PyNone, PyObj, NUM, CLASS, BOOL } from "../utils";
import { importObject } from "./import-object.test";
import { Value, Location } from "../ast";
import { BasicREPL } from "../repl";
import { MemoryManager } from "../alloc";

export function assertUsage(name: string, source: string, expected: Value, postUsage: bigint) {
  it(name, async () => {
    const repl = new BasicREPL(importObject);
    const manager = repl.memoryManager;
    expect(Number(manager.heapMemoryUsage())).to.equal(0);
    const result = await repl.run(source);
    expect(result).to.deep.eq(expected);
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

  assertUsage("Program 2",
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
    8n);

  assertUsage("Program 3",
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
    36n);

  assertUsage("Program 4",
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
    0n);

  assertUsage("Program 5",
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
    8n);
});
