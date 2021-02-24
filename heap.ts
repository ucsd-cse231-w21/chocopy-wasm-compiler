export interface Allocator {
  alloc: (size: bigint) => Block,

  // NOTE: this probably should take a Block
  free2: (ptr: bigint) => void,

  owns: (ptr: bigint) => boolean,

  description: () => string,
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

  free2(ptr: bigint) {
    // noop
  }

  owns(ptr: bigint): boolean {
    return ptr >= this.absStart && ptr < this.absEnd;
  }

  description(): string {
    return `Bump { counter: ${this.counter}, start: ${this.absStart}, end: ${this.absEnd} } `;
  }
}

// AllocList: [ { header, obj}, { header, obj }, { header, obj }]
//   header: {
//      prev: bigint,
//      next: bigint,
//   }
// BitMappedBlocks: [infomap, bucket1, bucket2, bucket3...]



// flag === true => fallback
// flag === false => primary
//
// flag defaults to false
export class Switch<P extends Allocator, F extends Allocator> {
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

  free2(ptr: bigint) {
    if (this.primary.owns(ptr)) {
      this.primary.free2(ptr);
    } else {
      this.fallback.free2(ptr);
    }
  }

  owns(ptr: bigint): boolean {
    return this.primary.owns(ptr) || this.fallback.owns(ptr);
  }

  description(): string {
    return `Switch { flag: ${this.flag}, primary: ${this.primary.description()}, fallback: ${this.fallback.description()}}`
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
export class Segregator<N extends bigint, S extends Allocator, L extends Allocator> {
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

  free2(ptr: bigint) {
    if (this.small.owns(ptr)) {
      this.small.free2(ptr);
    } else {
      this.large.free2(ptr);
    }
  }

  owns(ptr: bigint): boolean {
    return this.small.owns(ptr) || this.large.owns(ptr);
  }

  description(): string {
    return `Segregator { limit: ${this.sizeLimit.toString()}, small: ${this.small.description()}, large: ${this.large.description()}}`
  }
}

export class Describer<A extends Allocator> {
  message: string;
  allocator: A;

  constructor(a: A, d: string) {
    this.message = d;
    this.allocator = a;
  }

  alloc(size: bigint): Block {
    return this.allocator.alloc(size);
  }

  free2(ptr: bigint) {
    this.allocator.free2(ptr);
  }

  owns(ptr: bigint): boolean {
    return this.allocator.owns(ptr);
  }

  description(): string {
    return this.message;
  }
}

export class Fallback<P extends Allocator, F extends Allocator> {
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

  free2(ptr: bigint) {
    if (this.primary.owns(ptr)) {
      this.primary.free2(ptr);
    } else if (this.fallback.owns(ptr)) {
      this.fallback.free2(ptr);
    } else {
      throw new Error(`Attempting to free pointer (${ptr.toString()}) through allocators that do not own it: ${this.description()}`);
    }
  }

  owns(ptr: bigint): boolean {
    return this.primary.owns(ptr) || this.fallback.owns(ptr);
  }

  description(): string {
    return `Fallback { primary: ${this.primary.description()}, fallback: ${this.fallback.description()}}`;
  }
}


