import "mocha";
import { expect } from "chai";
import { PyInt, PyBool, PyNone } from "../utils";
import { Block, BitMappedBlocks } from "../heap";
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
    if (this.map.has(result)) {
      throw new Error(`Double allocation at ${result}`);
    }
    this.map.set(result, header);

    console.log(`Allocated ${size} at ${result} \t\t(tag=${tag}, header=${header.headerStart})`);
    return result;
  }

  getHeader(ptr: Pointer): Header {
    const result = this.heap.getHeader(ptr);
    const tracked = this.map.get(ptr);
    if (tracked === undefined) {
      throw new Error(`Missing header for ${ptr}`);
    }
    if (result.headerStart !== tracked.headerStart) {
      throw new Error(`Header starts not equal: { result: ${result.headerStart}, tracked: ${tracked.headerStart}}`);
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
}

describe("MnS", () => {
  describe("MnS-BumpAllocator-1", () => {
    let memory: Uint8Array;
    let heap: PhantomAllocator;

    beforeEach(() => {
      memory = new Uint8Array(512);
      const bmb = new BitMappedBlocks(100n, 200n, 4n, BigInt(HEADER_SIZE_BYTES));
      heap = new PhantomAllocator(bmb);
    });

    it("local variable class allocate and sweep", () => {
      const mns = new MnS(memory, heap);

      const ptr0 = mns.gcalloc(TAG_CLASS, 4n);
      expect(Number(ptr0)).to.equal(100);

      const ptr1 = mns.gcalloc(TAG_CLASS, 4n);
      expect(Number(ptr1)).to.equal(104);

      const ptr2 = mns.gcalloc(TAG_CLASS, 4n);
      expect(Number(ptr2)).to.equal(108);
    });
  });
});

