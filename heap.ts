interface Heap {
  owns: (ptr: bigint) => boolean,
}

interface Block {
  ptr: bigint,
  size: bigint,
}

const NULL_BLOCK: Block = {
  ptr: 0n,
  size: 0n,
};

// NOTE: No deallocation
// [counter, usableMemory...]
class BumpAllocator {
  counter: bigint,
  absStart: bigint,
  absEnd: bigint,

  constructor(s: bigint, e: bigint) {
    this.absStart = s;
    this.counter = s;
    this.absEnd = e;
  }

  alloc(size: bigint): Block {
    if (counter >= absEnd - size) {
      return NULL_BLOCK;
    }

    const ptr = this.counter;
    this.counter += size;
    return {
      ptr: ptr,
      size: size,
    };
  }
}

class AllocList {
  absStart: bigint,
  absEnd: bigint,
}

class BitMappedBlocks<BLOCK_SIZE, > {
  absStart: bigint,
  absEnd: bigint,
  b
}

// AllocList: [ { header, obj}, { header, obj }, { header, obj }]
//   header: {
//      prev: bigint,
//      next: bigint,
//   }
// BitMappedBlocks: [infomap: bucket1, bucket2, bucket3...]
