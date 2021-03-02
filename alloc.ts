import * as H from "./heap";
import * as GC from "./gc";
export {
  HeapTag,
  TAG_CLASS,
  TAG_LIST,
  TAG_STRING,
  TAG_DICT,
  TAG_BIGINT,
} from "./gc";

// Untagged pointer (32-bits)
export type Pointer = bigint;

// Public API for memory allocation/GC
export class MemoryManager {
  memory: Uint8Array;
  staticAllocator: H.BumpAllocator;

  // In the future, we can do something like
  // globalAllocator: Fallback<BumpAllocator, Generic>
  gc: GC.MnS<H.BumpAllocator>;

  constructor(memory: Uint8Array, globalStorage: bigint, total: bigint) {
    this.memory = memory;
    this.staticAllocator = new H.BumpAllocator(memory, 0n, globalStorage);
    const gcHeap = new H.BumpAllocator(memory, globalStorage, total);
    this.gc = new GC.MnS(memory, gcHeap);
  }

  forceCollect() {
    this.gc.collect();
  }

  // Tries to add `value` to the GC's root set if it is a pointer
  addRoot(value: bigint) {
    if (isPointer(value)) {
      const ptr = extractPointer(value);
      this.gc.addRoot([ptr]);
    }
  }

  removeRoot(value: bigint) {
    if (isPointer(value)) {
      const ptr = extractPointer(value);
      this.gc.removeRoot([ptr]);
    }
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

  // For data that will never be freed
  // Ex:
  //   1) Class descriptors
  //   2) Global variables
  staticAlloc(size: bigint): Pointer {
    const block = this.staticAllocator.alloc(size);
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
