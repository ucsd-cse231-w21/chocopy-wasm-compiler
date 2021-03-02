import * as H from "./heap";

// Untagged pointer (32-bits)
export type Pointer = bigint;

export type HeapTag =
  | typeof TAG_CLASS
  | typeof TAG_LIST
  | typeof TAG_STRING
  | typeof TAG_DICT
  | typeof TAG_BIGINT;

export const TAG_CLASS   = 0x1;
export const TAG_LIST    = 0x2;
export const TAG_STRING  = 0x3;
export const TAG_DICT    = 0x4;
export const TAG_BIGINT  = 0x5;

// Offset in BYTES
const HEADER_OFFSET_TAG    = 0x0;
const HEADER_OFFSET_SIZE   = 0x1;
const HEADER_OFFSET_GC     = HEADER_OFFSET_TAG + HEADER_OFFSET_SIZE;

//
// Proxy for constructed GC object headers
//
// Layout (byte addresses):
//   0  [TSSSSGP...]                             END
//      ^
//      headerStart
//
//   * T: 8 bit tag field
//   * S: 32-bit size field
//   * G: 8-bit GC metadata
//   * P: n-bit padding
//
// GC metadata:
//   MSB [XXXX_XXXM] LSB
//
//     * M: markbit
//     * X: unassigned
//
export class Header {
  headerStart: number;
  memory: Uint8Array;

  constructor(memory: Uint8Array, headerStart: bigint) {
    this.headerStart = Number(headerStart);
    this.memory = memory;
  }

  getTag(): HeapTag {
    // NOTE(alex): Enforce tag correctness in object construction API
    return this.memory[this.headerStart + HEADER_OFFSET_TAG] as HeapTag;
  }

  getSize(): bigint {
    let x = BigInt.asUintN(32, 0x0n);

    // WASM stores integers in little-endian:
    //   LSB at the smallest address
    for (let i = 0; i < 4; i++) {
      const b = BigInt(this.memory[this.headerStart + HEADER_OFFSET_SIZE + i]);
      x = x + (b << BigInt(8 * i));
    }

    return x;
  }

  // NOTE(alex): assumes single-threaded to not need to lock the GC byte
  mark() {
    const offset = this.headerStart + HEADER_OFFSET_GC;
    const b = this.memory[offset];
    const nb = b | 0x1;
    this.memory[offset] = nb;
  }

  // NOTE(alex): assumes single-threaded to not need to lock the GC byte
  unmark() {
    const offset = this.headerStart + HEADER_OFFSET_GC;
    const b = this.memory[offset];
    const nb = b & ~0x1;
    this.memory[offset] = nb;
  }

  // NOTE(alex): assumes single-threaded to not need to lock the GC byte
  isMarked(): boolean {
    const offset = this.headerStart + HEADER_OFFSET_GC;
    const b = this.memory[offset];
    return Boolean((b & 0x1) === 0x1);
  }
}

// Allocator operations required by a mark-and-sweep GC
export interface MarkableAllocator extends H.Allocator {
  getHeader: (ptr: Pointer) => Header,

  // size: size of object (NOT including header/metadata)
  // tag: heap object tag to know how to traverse the object
  //
  // returns an untagged pointer to the start of the object's memory (not the header)
  gcalloc: (tag: HeapTag, size: bigint) => bigint,

  mark: (roots: Array<Pointer>) => void,
  collect: () => void,
}

export class MnS {
  // heap: Segregator<500, Segregator<100, BitMappedBlocks<100>, BitMappedBlocks<500>>, AllocList>;
  heap: H.Segregator<500n, H.Segregator<100n, H.BumpAllocator, H.BumpAllocator>, H.BumpAllocator>;
}
