import "mocha";
import { expect } from "chai";
import { PyInt, PyBool, PyNone } from "../utils";
import { Block, BitMappedBlocks, FreeListAllocator } from "../heap";
import {
  Header,
  HEADER_SIZE_BYTES,
  HeapTag,
  MarkableAllocator,
  MnS,
  TAG_CLASS,
  TAG_LIST,
  TAG_STRING,
  TAG_DICT,
  TAG_BIGINT,
  TAG_REF,
  TAG_DICT_ENTRY,
  TAG_OPAQUE,
} from "../gc";

import { Pointer } from "../alloc";

class PhantomAllocator implements MarkableAllocator {
  heap: MarkableAllocator;
  map: Map<BigInt, Header>;

  constructor(a: MarkableAllocator) {
    this.heap = a;
    this.map = new Map();
  }

  alloc(size: bigint): Block {
    return this.heap.alloc(size);
  }

  free2(ptr: Pointer): void {
    if (!this.map.delete(ptr)) {
      throw new Error(`Pointer '${ptr}' is not in the map`);
    }
    this.heap.free2(ptr);
  }

  owns(ptr: Pointer): boolean {
    const result = this.heap.owns(ptr);
    const tracking = !this.map.has(ptr);
    if ((result && !tracking) || (!result && tracking)) {
      throw new Error(`Ownership mismatch: { result: ${result}, tracking: ${tracking}}`);
    }

    return result && tracking;
  }

  gcalloc(tag: HeapTag, size: bigint): Pointer {
    console.log(`Trying to allocate size: ${size}\t(tag=${tag})`);
    const result = this.heap.gcalloc(tag, size);
    if (result === 0x0n) {
      console.log(`Failed to allocated ${size}\t\t(tag=${tag})`);
      return result;
    }

    const header = this.heap.getHeader(result);
    this.map.set(result, header);

    console.log(`Allocated ${size} at ${result} \t\t(tag=${tag}, header=${header.headerStart})`);
    return result;
  }

  mappedHeader(ptr: BigInt): Header {
    const result = this.map.get(ptr);
    if (result === undefined) {
      throw new Error(`No header mapped for ${ptr}`);
    }
    return result;
  }

  getHeader(ptr: Pointer): Header {
    const result = this.heap.getHeader(ptr);
    const tracked = this.map.get(ptr);
    if (tracked === undefined) {
      throw new Error(`Missing header for ${ptr}`);
    }
    if (result.headerStart !== tracked.headerStart) {
      throw new Error(
        `Header starts not equal: { result: ${result.headerStart}, tracked: ${tracked.headerStart}}`
      );
    }

    return result;
  }

  sweep() {
    console.log("Sweeping...");
    this.heap.sweep();
    console.log("Finished sweeping");
  }

  description(): string {
    throw new Error("unreachable");
  }

  memoryUsage(): bigint {
    return this.heap.memoryUsage();
  }
}

function readI32(memory: Uint8Array, start: number): bigint {
  let x = BigInt.asUintN(32, 0x0n);

  // WASM stores integers in little-endian:
  //   LSB at the smallest address
  for (let i = 0; i < 4; i++) {
    const b = BigInt(memory[start + i]);
    x = x + (b << BigInt(8 * i));
  }

  return x;
}

function writeI32(memory: Uint8Array, start: number, value: bigint) {
  // WASM stores integers in little-endian:
  //   LSB at the smallest address
  for (let i = 0; i < 4; i++) {
    const b = BigInt.asUintN(8, value >> BigInt(8 * i));
    memory[start + i] = Number(b);
  }
}

function expectAllocatedHeader(header: Header, tag: HeapTag, size: bigint) {
  expect(header.isAlloced()).to.equal(true);
  expect(header.isMarked()).to.equal(false);
  expect(Number(header.getSize())).to.equal(Number(size));
  expect(Number(header.getTag())).to.equal(Number(tag));
}

function expectMarkedHeader(header: Header, tag: HeapTag, size: bigint) {
  expect(header.isAlloced()).to.equal(true);
  expect(header.isMarked()).to.equal(true);
  expect(Number(header.getSize())).to.equal(Number(size));
  expect(Number(header.getTag())).to.equal(Number(tag));
}

function expectFreeHeader(header: Header, tag: HeapTag, size: bigint) {
  expect(header.isAlloced()).to.equal(false);
  expect(header.isMarked()).to.equal(false);
  expect(Number(header.getSize())).to.equal(Number(size));
  expect(Number(header.getTag())).to.equal(Number(tag));
}

type Cfg = {
  heap: PhantomAllocator;
  memory: Uint8Array;
  name: string;
  kind: "freelist" | "bitmap";
};

// GC mark-and-sweep unit tests under controlled conditions
describe("GC-MnS", () => {
  describe("Problematic alloc pattern", () => {
    // Simulates:
    //   REPL1:
    //     d: [int, int] = None
    //     d = {3:4}
    //
    //   REPL2:
    //     d[3]
    //
    //   REPL3:
    //     d[9] = 19
    //
    it("dictionary-repl", () => {
      const memory = new Uint8Array(2000);
      const fl = new FreeListAllocator(memory, 772n, 2000n);
      const heap = new PhantomAllocator(fl);
      const mns = new MnS(memory, heap);

      mns.roots.pushFrame();
      const ptr0 = mns.gcalloc(TAG_DICT, 40n);
      expect(Number(ptr0)).to.equal(1960);
      const header0 = heap.mappedHeader(ptr0);
      expectAllocatedHeader(header0, TAG_DICT, 40n);
      mns.roots.addLocal(0n, ptr0);
      mns.collect();

      const ptr1 = mns.gcalloc(TAG_DICT_ENTRY, 12n);
      expect(Number(ptr1)).to.equal(1940);
      const header1 = heap.mappedHeader(ptr1);

      // Simulates inserting into the dictionary
      // ptr1 gets written at 1988
      writeI32(memory, 1988, ptr1);

      expectAllocatedHeader(header0, TAG_DICT, 40n);
      expectAllocatedHeader(header1, TAG_DICT_ENTRY, 12n);
      mns.markFromRoots();
      expectMarkedHeader(header0, TAG_DICT, 40n);
      expectMarkedHeader(header1, TAG_DICT_ENTRY, 12n);
      mns.sweep();

      const ptr2 = mns.gcalloc(TAG_DICT_ENTRY, 12n);
      expect(Number(ptr2)).to.equal(1920);
      const header2 = heap.mappedHeader(ptr2);

      // Simulates inserting into the dictionary
      // ptr2 gets written at 1996
      writeI32(memory, 1996, ptr2);

      mns.collect();
      expectAllocatedHeader(header0, TAG_DICT, 40n);
      expectAllocatedHeader(header1, TAG_DICT_ENTRY, 12n);
      expectAllocatedHeader(header2, TAG_DICT_ENTRY, 12n);

      mns.roots.releaseLocals();
    });
  });

  describe("GC-MnS-BitMappedBlocks-1", () => {
    function makeCfg(): Cfg {
      const memory = new Uint8Array(1000);
      const bmb = new BitMappedBlocks(100n, 1000n, 4n, BigInt(HEADER_SIZE_BYTES));
      const heap = new PhantomAllocator(bmb);

      return {
        heap: heap,
        memory: memory,
        name: "BitMappedBlocks",
        kind: "bitmap",
      };
    }

    // Need to give each test a blank slate
    const cfgs: [Cfg, Cfg, Cfg] = [makeCfg(), makeCfg(), makeCfg()];
    basicTests(cfgs);
  });

  // NOTE(alex:mm): relies on HEADER_SIZE_BYTES === 8
  // FreeListAllocator puts headers in memory
  describe("GC-MnS-FreeList-1", () => {
    function makeCfg(): Cfg {
      const memory = new Uint8Array(1000);
      const alloc = new FreeListAllocator(memory, 100n, 1000n);
      const heap = new PhantomAllocator(alloc);

      return {
        heap: heap,
        memory: memory,
        name: "FreeList",
        kind: "freelist",
      };
    }

    it("check HEADER_SIZE_BYTES === 8", () => {
      expect(HEADER_SIZE_BYTES).to.equal(8);
    });

    // Need to give each test a blank slate
    const cfgs: [Cfg, Cfg, Cfg] = [makeCfg(), makeCfg(), makeCfg()];
    basicTests(cfgs);
  });
});

// Assumes:
//   * start: 100
//   * end:   1000
function basicTests(cfgs: [Cfg, Cfg, Cfg]) {
  // Simulating:
  // class C:
  //   f: int
  //
  // def x():
  //   x = C()
  //   x = C()
  //   y = C()
  //
  // f()
  it(`[${cfgs[0].name}] local variable class allocate and sweep`, () => {
    const heap = cfgs[0].heap;
    const memory = cfgs[0].memory;
    const mns = new MnS(memory, heap);
    const kind = cfgs[0].kind;

    mns.roots.pushFrame();
    const ptr0 = mns.gcalloc(TAG_CLASS, 4n);
    if (kind === "bitmap") {
      expect(Number(ptr0)).to.equal(100);
    } else if (kind === "freelist") {
      expect(Number(ptr0)).to.equal(996);
    }
    mns.roots.addLocal(0n, ptr0);

    const ptr1 = mns.gcalloc(TAG_CLASS, 4n);
    if (kind === "bitmap") {
      expect(Number(ptr1)).to.equal(104);
    } else if (kind === "freelist") {
      expect(Number(ptr1)).to.equal(984);
    }
    mns.roots.addLocal(0n, ptr1);

    const ptr2 = mns.gcalloc(TAG_CLASS, 4n);
    if (kind === "bitmap") {
      expect(Number(ptr2)).to.equal(108);
    } else if (kind === "freelist") {
      expect(Number(ptr2)).to.equal(972);
    }
    mns.roots.addLocal(1n, ptr2);

    // Check that headers set correctly
    {
      const headers = [heap.mappedHeader(ptr0), heap.mappedHeader(ptr1), heap.mappedHeader(ptr2)];
      headers.forEach((h, index) => {
        console.log(`Checking header: ${index}...`);
        expectAllocatedHeader(h, TAG_CLASS, 4n);
      });
    }

    mns.collect();

    // Check that only ptr0 is freed
    {
      const header0 = heap.mappedHeader(ptr0);
      const header1 = heap.mappedHeader(ptr1);
      const header2 = heap.mappedHeader(ptr2);

      expectFreeHeader(header0, TAG_CLASS, 4n);
      expectAllocatedHeader(header1, TAG_CLASS, 4n);
      expectAllocatedHeader(header2, TAG_CLASS, 4n);
    }

    mns.roots.releaseLocals();
    mns.collect();
    // Check that ptr0, ptr1, ptr2 is freed
    {
      const headers = [heap.mappedHeader(ptr0), heap.mappedHeader(ptr1), heap.mappedHeader(ptr2)];
      headers.forEach((h, index) => {
        // console.warn(`Checking header: ${index}...`);
        expectFreeHeader(h, TAG_CLASS, 4n);
      });
    }
    const ptr0new = mns.gcalloc(TAG_CLASS, 4n);
    if (kind === "bitmap") {
      expect(Number(ptr0new)).to.equal(100);
    } else if (kind === "freelist") {
      expect(Number(ptr0new)).to.equal(996);
    }

    if (kind === "bitmap") {
      expectFreeHeader(heap.heap.getHeader(112n), 0x0n as HeapTag, 0n);
    }
  });

  // Simulates:
  //
  //   call(C(), C(), C())
  it(`[${cfgs[1].name}] temporary class allocate and sweep`, () => {
    const heap = cfgs[1].heap;
    const memory = cfgs[1].memory;
    const kind = cfgs[1].kind;

    const mns = new MnS(memory, heap);

    mns.roots.captureTemps();
    const ptr0 = mns.gcalloc(TAG_CLASS, 4n);
    if (kind === "bitmap") {
      expect(Number(ptr0)).to.equal(100);
    } else if (kind === "freelist") {
      expect(Number(ptr0)).to.equal(996);
    }

    const ptr1 = mns.gcalloc(TAG_CLASS, 4n);
    if (kind === "bitmap") {
      expect(Number(ptr1)).to.equal(104);
    } else if (kind === "freelist") {
      expect(Number(ptr1)).to.equal(984);
    }

    const ptr2 = mns.gcalloc(TAG_CLASS, 4n);
    if (kind === "bitmap") {
      expect(Number(ptr2)).to.equal(108);
    } else if (kind === "freelist") {
      expect(Number(ptr2)).to.equal(972);
    }

    // Check that headers set correctly
    {
      const headers = [heap.mappedHeader(ptr0), heap.mappedHeader(ptr1), heap.mappedHeader(ptr2)];
      headers.forEach((h, index) => {
        console.log(`Checking header: ${index}...`);
        expectAllocatedHeader(h, TAG_CLASS, 4n);
      });
    }
    mns.collect();
    // Check that all temps are still allocated
    {
      const headers = [heap.mappedHeader(ptr0), heap.mappedHeader(ptr1), heap.mappedHeader(ptr2)];
      headers.forEach((h, index) => {
        console.log(`Checking header: ${index}...`);
        expectAllocatedHeader(h, TAG_CLASS, 4n);
      });
    }

    mns.roots.releaseTemps();
    mns.collect();
    // Check that ptr0, ptr1, ptr2 is freed
    {
      const headers = [heap.mappedHeader(ptr0), heap.mappedHeader(ptr1), heap.mappedHeader(ptr2)];
      headers.forEach((h, index) => {
        // console.warn(`Checking header: ${index}...`);
        expectFreeHeader(h, TAG_CLASS, 4n);
      });
    }
    const ptr0new = mns.gcalloc(TAG_CLASS, 4n);
    if (kind === "bitmap") {
      expect(Number(ptr0new)).to.equal(100);
    } else if (kind === "freelist") {
      expect(Number(ptr0new)).to.equal(996);
    }

    if (kind === "bitmap") {
      expectFreeHeader(heap.heap.getHeader(112n), 0x0n as HeapTag, 0n);
    }
  });

  // Simulates:
  //
  //   x = C()
  //   y = C()
  //
  //   y = C()
  it(`[${cfgs[2].name}] global var class allocate and sweep`, () => {
    const heap = cfgs[2].heap;
    const memory = cfgs[2].memory;
    const kind = cfgs[2].kind;
    const mns = new MnS(memory, heap);

    const X_ADDR = 0x4n;
    const Y_ADDR = 0x8n;

    mns.roots.addGlobal(X_ADDR);
    mns.roots.addGlobal(Y_ADDR);

    mns.roots.captureTemps();
    const ptr0 = mns.gcalloc(TAG_CLASS, 4n);
    if (kind === "bitmap") {
      expect(Number(ptr0)).to.equal(100);
    } else if (kind === "freelist") {
      expect(Number(ptr0)).to.equal(996);
    }
    writeI32(memory, Number(X_ADDR), ptr0);

    const ptr1 = mns.gcalloc(TAG_CLASS, 4n);
    if (kind === "bitmap") {
      expect(Number(ptr1)).to.equal(104);
    } else if (kind === "freelist") {
      expect(Number(ptr1)).to.equal(984);
    }
    writeI32(memory, Number(Y_ADDR), ptr1);

    const ptr2 = mns.gcalloc(TAG_CLASS, 4n);
    if (kind === "bitmap") {
      expect(Number(ptr2)).to.equal(108);
    } else if (kind === "freelist") {
      expect(Number(ptr2)).to.equal(972);
    }

    // Check that headers set correctly
    {
      const headers = [heap.mappedHeader(ptr0), heap.mappedHeader(ptr1), heap.mappedHeader(ptr2)];
      headers.forEach((h, index) => {
        console.log(`Checking header: ${index}...`);
        expectAllocatedHeader(h, TAG_CLASS, 4n);
      });
    }

    mns.roots.releaseTemps();
    mns.collect();
    // Check that global roots are not collected
    {
      const headers = [heap.mappedHeader(ptr0), heap.mappedHeader(ptr1)];
      headers.forEach((h, index) => {
        console.log(`Checking header: ${index}...`);
        expectAllocatedHeader(h, TAG_CLASS, 4n);
      });
      expectFreeHeader(heap.mappedHeader(ptr2), TAG_CLASS, 4n);
    }

    const ptr3 = mns.gcalloc(TAG_CLASS, 4n);
    if (kind === "bitmap") {
      expect(Number(ptr3)).to.equal(108);
    } else if (kind === "freelist") {
      expect(Number(ptr3)).to.equal(972);
    }
    // Overwrite y
    writeI32(memory, Number(Y_ADDR), ptr3);
    mns.collect();

    // Check that global roots are not collected
    {
      const headers = [heap.mappedHeader(ptr0), heap.mappedHeader(ptr3)];
      headers.forEach((h, index) => {
        console.log(`Checking header: ${index}...`);
        expectAllocatedHeader(h, TAG_CLASS, 4n);
      });
      expectFreeHeader(heap.mappedHeader(ptr1), TAG_CLASS, 4n);
    }
  });
}
