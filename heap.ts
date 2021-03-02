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
    if (this.counter !== 0n) {
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
export class Segregator<N extends bigint, S extends Allocator, L extends Allocator>
  implements Allocator {
  sizeLimit: N;
  small: S;
  large: L;

  constructor(sizeLimit: N, s: S, l: L) {
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
