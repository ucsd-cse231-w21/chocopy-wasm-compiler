export interface Heap {
  // The heap owns this ptr
  owns: (ptr: bigint) => boolean,
}

export interface Block {
  ptr: bigint,
  size: bigint,
}

const NULL_BLOCK: Block = {
  ptr: 0n,
  size: 0n,
};

// NOTE: No deallocation
// [counter, usableMemory...]
export class BumpAllocator {
  counter: bigint;
  absStart: bigint;
  absEnd: bigint;

  constructor(s: bigint, endExclusive: bigint) {
    this.absStart = s;
    this.counter = s;
    this.absEnd = endExclusive;

    if (endExclusive <= s) {
      throw new Error(`Error: end (${endExclusive.toString()})<= start of memory (${s.toString()})`);
    }
  }

  alloc(size: bigint): Block {
    if (this.counter >= this.absEnd - size) {
      return NULL_BLOCK;
    }

    const ptr = this.counter;
    this.counter += size;
    return {
      ptr: ptr,
      size: size,
    };
  }

  owns(ptr: bigint): boolean {
    return ptr >= this.absStart && ptr < this.absEnd;
  }
}

// AllocList: [ { header, obj}, { header, obj }, { header, obj }]
//   header: {
//      prev: bigint,
//      next: bigint,
//   }
// BitMappedBlocks: [infomap: bucket1, bucket2, bucket3...]
