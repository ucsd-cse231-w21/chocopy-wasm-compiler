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

  owns(ptr: bigint): boolean {
    return ptr >= this.absStart && ptr < this.absEnd;
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
export class Switch {
  flag: boolean;
  primary: Allocator;
  fallback: Allocator;

  constructor(p: Allocator, f: Allocator) {
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
    return `Segregator { flag: ${this.flag}, primary: ${this.primary.description()}, fallback: ${this.fallback.description()}}`
  }

  setFlag(f: boolean) {
    this.flag = f;
  }

  toggleFlag() {
    this.flag = !this.flag;
  }
}

// Allocation sizes <= sizeLimit go to the small allocator
export class Segregator {
  sizeLimit: bigint;
  small: Allocator;
  large: Allocator;

  constructor(sizeLimit: bigint, s: Allocator, l: Allocator) {
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

export class Describer {
  message: string;
  allocator: Allocator;

  constructor(a: Allocator, d: string) {
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

export class Fallback {
  primary: Allocator;
  fallback: Allocator;

  constructor(primary: Allocator, fallback: Allocator) {
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

