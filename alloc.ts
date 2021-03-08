import * as H from "./heap";
import * as GC from "./gc";
export { HeapTag, TAG_CLASS, TAG_LIST, TAG_STRING, TAG_DICT, TAG_BIGINT } from "./gc";

// Untagged pointer (32-bits)
export type Pointer = bigint;

export function toHeapTag(tag: bigint): GC.HeapTag {
  if (
    tag === GC.TAG_CLASS ||
    tag === GC.TAG_LIST ||
    tag === GC.TAG_STRING ||
    tag === GC.TAG_DICT ||
    tag === GC.TAG_BIGINT
  ) {
    return tag;
  }

  throw new Error(`${tag.toString()} is not a valid heap tag`);
}

export function importMemoryManager(importObject: any, mm: MemoryManager) {
  importObject.imports.memoryManager = mm;

  importObject.imports.gcalloc = function (tag: number, size: number): number {
    return Number(mm.gcalloc(toHeapTag(BigInt(tag)), BigInt(size)));
  };

  importObject.imports.addTemp = function (value: number): number {
    mm.addTemp(BigInt(value));
    return value;
  };
  importObject.imports.captureTemps = function () {
    mm.captureTemps();
  };
  importObject.imports.releaseTemps = function () {
    mm.releaseTemps();
  };

  importObject.imports.pushFrame = function () {
    mm.pushFrame();
  };

  importObject.imports.addLocal = function (value: number) {
    mm.addLocal(BigInt(value));
  };
  importObject.imports.removeLocal = function (value: number) {
    mm.removeLocal(BigInt(value));
  };
  importObject.imports.releaseLocals = function () {
    mm.releaseLocals();
  };

  importObject.imports.forceCollect = function () {
    mm.forceCollect();
  };
}

// Public API for memory allocation/GC
export class MemoryManager {
  memory: Uint8Array;
  staticAllocator: H.BumpAllocator;

  // In the future, we can do something like
  // globalAllocator: Fallback<BumpAllocator, Generic>
  gc: GC.MnS<H.BumpAllocator>;

  constructor(
    memory: Uint8Array,
    cfg: {
      staticStorage: bigint;
      total: bigint;
    }
  ) {
    this.memory = memory;
    this.staticAllocator = new H.BumpAllocator(memory, 4n, cfg.staticStorage + 4n);
    const gcHeap = new H.BumpAllocator(memory, cfg.staticStorage, cfg.total);
    this.gc = new GC.MnS(memory, gcHeap);
  }

  forceCollect() {
    this.gc.collect();
  }

  // Add a potential pointer to the set of temporary roots
  //
  // This function is necessary to allow pointers to escape into the caller's
  //   temp. root frame.
  addTemp(value: bigint) {
    this.gc.roots.addTemp(value);
  }

  // All heap allocations after this call will be added to the set of temporary roots
  //
  // Usage:
  //    captureTemps()
  //    a bunch of `gcalloc()`
  //    releaseTemps()
  //    update local variables
  //
  // This pattern is necessary because:
  //   * Each call to `gcalloc` may run the GC
  //   * Objects that are not reachable from the root set will be collected
  //   * JS cannot access the WASM stack to scan ChocoPy variables/temporaries for pointers
  //
  // If between `gcalloc` calls the GC is run, temporary objects may be de-allocated
  //   because they may not be reachable.
  //
  // By calling `captureTemps()`, the GC will consider all newly allocated objects rooted
  //   until `releaseTemps()` is called,
  captureTemps() {
    this.gc.roots.captureTemps();
  }

  // Clear the set of temporary roots
  // Further heap allocations will not be marked as temporary roots
  //   until `captureTemps()` is called
  releaseTemps() {
    this.gc.roots.releaseTemps();
  }

  // Pushes a new stack frame for tracking local variable roots
  pushFrame() {
    this.gc.roots.pushFrame();
  }

  // value: potential pointer to a heap object
  //
  // Add a potential pointer to the local variable root set
  // If value is not a pointer, it will not be added
  addLocal(value: bigint) {
    this.gc.roots.addLocal(value);
  }

  // Remove a potential pointer to the local variable root set
  removeLocal(value: bigint) {
    this.gc.roots.removeLocal(value);
  }

  // Pops the current stack frame
  releaseLocals() {
    this.gc.roots.releaseLocals();
  }

  // ptr: address of the global variable in linear memory
  //
  // Adds the pointer to the global variable root set
  addGlobal(ptr: Pointer) {
    this.gc.roots.addGlobal(ptr);
  }

  // size: size of object in bytes (NOT including header/metadata)
  // tag: heap object tag to know how to traverse the object
  //
  // Allocates memory of the requested size
  //   * Allocates additional memory to store GC metadata, tag, and size
  //
  // Returns an untagged pointer to the start of the object's memory (not the header)
  // Throws 'Out of memory' if allocation failed after the GC ran
  gcalloc(tag: GC.HeapTag, size: bigint): Pointer {
    const result = this.gc.gcalloc(tag, size);
    if (result == 0x0n) {
      throw new Error(`Out of memory`);
    }
    return result;
  }

  // size: requested memory in bytes
  //
  // For data that will never be freed
  // Ex:
  //   1) Class descriptors
  //   2) Global variables
  //
  // Throws `Out of static storage` if allocation fails
  staticAlloc(size: bigint): Pointer {
    const block = this.staticAllocator.alloc(size);
    // NOTE(alex:mm): need to compare to the NULL_BLOCK b/c the pointer
    //   may be address 0x0
    if (block === H.NULL_BLOCK) {
      console.error(`start: ${this.staticAllocator.absStart}`);
      console.error(`end: ${this.staticAllocator.absEnd}`);
      console.error(`counter: ${this.staticAllocator.counter}`);
      console.error(`request: ${size.toString()}`);
      throw new Error(`Out of static storage`);
    }
    return block.ptr;
  }

  getTag(ptr: Pointer): GC.HeapTag {
    const header = this.gc.heap.getHeader(ptr);
    return header.getTag();
  }

  getSize(ptr: Pointer): bigint {
    const header = this.gc.heap.getHeader(ptr);
    return header.getSize();
  }
}

// value: 32-bit bigint
// Uses the least significant bit as a tag:
//   * `0` => pointer
//   * `1` => primitive value
export function isPointer(value: bigint): boolean {
  return Boolean((value & 0x1n) === 0x0n);
}

// taggedPtr: 32-bit bigint
// Tagged as a pointer
//
// NOTE(alex): NOP
//   * Assumes that all heap allocations are aligned properly such
//     that the LSB of all pointers is always `0`
//
export function extractPointer(taggedPtr: bigint): Pointer {
  // nop
  return taggedPtr;
}
