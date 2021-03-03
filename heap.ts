import { Pointer } from "./alloc";
import {
  Header,
  HeapTag,
  HEADER_SIZE_BYTES,
  MarkableAllocator,
} from "./gc";

export interface Allocator {
  alloc: (size: bigint) => Block;

  // NOTE: this probably should take a Block
  free2: (ptr: Pointer) => void;

  owns: (ptr: Pointer) => boolean;

  description: () => string;
}

export interface Block {
  ptr: Pointer;
  size: bigint;
}

export const NULL_BLOCK: Block = {
  ptr: 0n,
  size: 0n,
};

// Bump allocator implementation
// * Deallocation is a NOP
export class BumpAllocator implements MarkableAllocator {
  memory: Uint8Array;
  counter: bigint;
  absStart: bigint;
  absEnd: bigint;

  constructor(memory: Uint8Array, s: bigint, endExclusive: bigint) {
    this.memory = memory;
    this.absStart = s;
    this.counter = s;
    this.absEnd = endExclusive;

    // Ensure allocations are always aligned on an even boundary
    if (s % 2n !== 0n) {
      this.counter += 1n;
    }

    if (endExclusive <= s) {
      throw new Error(
        `Error: end (${endExclusive.toString()})<= start of memory (${s.toString()})`
      );
    }
  }

  alloc(size: bigint): Block {
    if (this.counter >= this.absEnd - size) {
      return NULL_BLOCK;
    }

    const ptr = this.counter;
    this.counter += size;

    // Ensure allocations are always aligned on an even boundary
    if (this.counter % 2n !== 0n) {
      this.counter += 1n;
    }

    return {
      ptr: ptr,
      size: size,
    };
  }

  free2(ptr: Pointer) {
    // noop
  }

  owns(ptr: Pointer): boolean {
    return ptr >= this.absStart && ptr < this.absEnd;
  }

  description(): string {
    return `Bump { counter: ${this.counter}, start: ${this.absStart}, end: ${this.absEnd} } `;
  }

  getHeader(ptr: Pointer): Header {
    const headerPtr = ptr - BigInt(HEADER_SIZE_BYTES);
    return new Header(this.memory, headerPtr);
  }

  gcalloc(tag: HeapTag, size: bigint): Pointer {
    const allocSize = size + BigInt(HEADER_SIZE_BYTES);
    // Try to allocate the requested size + GC headers
    const block = this.alloc(allocSize);
    if (block === NULL_BLOCK) {
      return 0x0n;
    }

    const header = new Header(this.memory, block.ptr);
    header.alloc();
    header.setSize(size);
    header.setTag(tag);

    return block.ptr + BigInt(HEADER_SIZE_BYTES);
  }

  // BumpAllocator only releases memory when the entire allocator is released
  // Any garbage will accumulate but since it is unreachable, we do not care
  sweep() {
    // NOP
  }
}

// AllocList: [ { header, obj}, { header, obj }, { header, obj }]
//   header: {
//      prev: bigint,
//      next: bigint,
//   }
// BitMappedBlocks: [infomap, bucket1, bucket2, bucket3...]

export class BitMappedBlocks implements MarkableAllocator {
  start: bigint;
  end: bigint;
  numBlocks: bigint;
  blockSize: bigint;
  metadataSize: bigint;
  infomap: Uint8Array;

  constructor(start: bigint, end: bigint, blockSize: bigint, metadataSize: bigint) {
    this.start = start + (start % 2n); // Align at even boundary
    this.end = end;
    this.blockSize = blockSize + (blockSize % 2n);
    this.metadataSize = metadataSize + 1n; // 1(bitmap) + object header size

    this.numBlocks = (end - start)/blockSize;

    // one byte for free/used, n bytes for header
    const totalNBytes = Number(this.metadataSize * this.numBlocks);
    this.infomap = new Uint8Array(totalNBytes);
  }

  isFree (index: bigint): boolean {
    return this.infomap[Number(this.metadataSize * index)] === 0
  }

  getNumFreeBlocks() {
    let count = 0;
    for(let index = 0n; index < this.numBlocks; ++index) {
      if(this.isFree(index)) {
        ++count;
      }
    }

    return count;
  }

  // Returns the block index that can satisfy the requested `size`
  // Returns -1 to indicate a failure
  getBlockIndex (size: bigint): bigint {
    // How many blocks are needed to satisfy the request
    const blocksRequested = size/this.blockSize;

    // Linearly Traverse the infomap to find blocks
    // This can lead to fragmentation
    // Can this be optimized further?
    let index = 0n;
    while(index < this.numBlocks) {

      // Find the first free block
      while(!this.isFree(index)) {
        ++index;
      }

      // Hit the end
      if(index + blocksRequested > this.numBlocks) {
        return -1n;
      }

      let count = 1n; // Keep track of free blocks

      while(count < blocksRequested && index < this.numBlocks) {
        ++count;
        ++index;
      }

      if(count == blocksRequested) {
        return index;
      }
    }

    return -1n;
  }

  alloc(size: bigint): Block {
    // Search for a free block(or a group of contiguous free blocks)`
    const blockIndex = this.getBlockIndex(size);
    if(blockIndex === -1n) {
      return NULL_BLOCK;
    }

    let nBlocks = size/this.blockSize;
    if(size % this.blockSize !== 0n) {
      nBlocks += 1n; // (Hack) in place of Math.ceil
    }

    // Set the bit(byte) as "used"
    // Size is stored in header -  Useful when sweeping
    // Edit: Store the number of blocks allocated instead of just 1 for the first block
    this.infomap[Number(this.metadataSize*blockIndex)] = Number(nBlocks);
    for(let index = blockIndex + 1n; index < blockIndex + nBlocks; ++index) {
      this.infomap[Number(this.metadataSize*index)] = 1;
    }

    return {
      ptr: this.start + BigInt(blockIndex) * this.blockSize,
      size: size
    }
  }

  free2(ptr: bigint) {
    // mark "ptr" block as free
    let index = (ptr - this.start)/this.blockSize;
    let nBlocks = this.infomap[Number(this.metadataSize * index)];
    while(nBlocks !== 0) {
      this.infomap[Number(this.metadataSize * index)] = 0;
      ++index;
      --nBlocks;
    }
  }

  owns(ptr: bigint): boolean {
    return ptr >= this.start && ptr <= this.end;
  }

  description(): string {
    return `BitMapped { Max blocks: ${this.numBlocks}, block size: ${this.blockSize}, free blocks: ${this.getNumFreeBlocks()} } `;
  }

  getHeader(ptr: Pointer): Header {
    return new Header(this.infomap, (ptr - this.start)/this.blockSize + 1n);
  }

  gcalloc(tag: HeapTag, size: bigint): Pointer {
    const block = this.alloc(size);

    if(block === NULL_BLOCK) {
      return 0x0n;
    }

    // Store header in the infomap
    // TODO: Verify if this is right
    // +1n to offset by byte for header
    const header = this.getHeader(block.ptr);
    header.alloc();
    header.setSize(size);
    header.setTag(tag);

    return block.ptr;
  }

  sweep() {
    let index = 0n
    while(index < this.numBlocks) {
      const header = new Header(this.infomap, BigInt(this.metadataSize * index + 1n));
      if(!header.isMarked()) {
        // Get number of blocks
        let nBlocks = this.infomap[Number(this.metadataSize * index)];

        while (nBlocks > 0 && index < this.numBlocks) {
          this.infomap[Number(this.metadataSize * index)] = 0; // Free it!
          ++index;
          --nBlocks;
        }
      } else {
        ++index;
      }
    }
  }
}



/// ==================================
/// Allocator combinators
/// ==================================


// flag === true => fallback
// flag === false => primary
//
// flag defaults to false
export class Switch<P extends Allocator, F extends Allocator> implements Allocator {
  flag: boolean;
  primary: P;
  fallback: F;

  constructor(p: P, f: F) {
    this.flag = false;

    this.primary = p;
    this.fallback = f;
  }

  alloc(size: bigint): Block {
    if (this.flag) {
      return this.fallback.alloc(size);
    } else {
      return this.primary.alloc(size);
    }
  }

  free2(ptr: Pointer) {
    if (this.primary.owns(ptr)) {
      this.primary.free2(ptr);
    } else {
      this.fallback.free2(ptr);
    }
  }

  owns(ptr: Pointer): boolean {
    return this.primary.owns(ptr) || this.fallback.owns(ptr);
  }

  description(): string {
    return `Switch { flag: ${
      this.flag
    }, primary: ${this.primary.description()}, fallback: ${this.fallback.description()}}`;
  }

  setFlag(f: boolean) {
    this.flag = f;
  }

  toggleFlag() {
    this.flag = !this.flag;
  }
}

// Allocation sizes <= sizeLimit go to the small allocator
// sizeLimit is in BYTES
export class Segregator<S extends Allocator, L extends Allocator>
  implements Allocator {
  sizeLimit: bigint;
  small: S;
  large: L;

  constructor(sizeLimit: bigint, s: S, l: L) {
    this.sizeLimit = sizeLimit;
    this.small = s;
    this.large = l;
  }

  alloc(size: bigint): Block {
    if (size <= this.sizeLimit) {
      return this.small.alloc(size);
    } else {
      return this.large.alloc(size);
    }
  }

  free2(ptr: Pointer) {
    if (this.small.owns(ptr)) {
      this.small.free2(ptr);
    } else {
      this.large.free2(ptr);
    }
  }

  owns(ptr: Pointer): boolean {
    return this.small.owns(ptr) || this.large.owns(ptr);
  }

  description(): string {
    return `Segregator { limit: ${this.sizeLimit.toString()}, small: ${this.small.description()}, large: ${this.large.description()}}`;
  }
}

export class Describer<A extends Allocator> implements Allocator {
  message: string;
  allocator: A;

  constructor(a: A, d: string) {
    this.message = d;
    this.allocator = a;
  }

  alloc(size: bigint): Block {
    return this.allocator.alloc(size);
  }

  free2(ptr: Pointer) {
    this.allocator.free2(ptr);
  }

  owns(ptr: Pointer): boolean {
    return this.allocator.owns(ptr);
  }

  description(): string {
    return this.message;
  }
}

export class Fallback<P extends Allocator, F extends Allocator> implements Allocator {
  primary: P;
  fallback: F;

  constructor(primary: P, fallback: F) {
    this.primary = primary;
    this.fallback = fallback;
  }

  alloc(size: bigint): Block {
    const b1 = this.primary.alloc(size);
    if (b1 === NULL_BLOCK) {
      return this.fallback.alloc(size);
    }

    return b1;
  }

  free2(ptr: Pointer) {
    if (this.primary.owns(ptr)) {
      this.primary.free2(ptr);
    } else if (this.fallback.owns(ptr)) {
      this.fallback.free2(ptr);
    } else {
      throw new Error(
        `Attempting to free pointer (${ptr.toString()}) through allocators that do not own it: ${this.description()}`
      );
    }
  }

  owns(ptr: Pointer): boolean {
    return this.primary.owns(ptr) || this.fallback.owns(ptr);
  }

  description(): string {
    return `Fallback { primary: ${this.primary.description()}, fallback: ${this.fallback.description()}}`;
  }
}
