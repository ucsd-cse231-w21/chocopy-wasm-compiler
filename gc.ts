import * as H from "./heap";
import { Block, NULL_BLOCK } from "./heap";
import {
  extractPointer,
  isPointer,
  Pointer
} from "./alloc";

export type HeapTag =
  | typeof TAG_CLASS
  | typeof TAG_LIST
  | typeof TAG_STRING
  | typeof TAG_DICT
  | typeof TAG_BIGINT;

export const TAG_CLASS   = 0x1n;
export const TAG_LIST    = 0x2n;
export const TAG_STRING  = 0x3n;
export const TAG_DICT    = 0x4n;
export const TAG_BIGINT  = 0x5n;

// Offset in BYTES
const HEADER_OFFSET_TAG    = 0x0;
const HEADER_OFFSET_SIZE   = 0x1;
const HEADER_OFFSET_GC     = HEADER_OFFSET_TAG + HEADER_OFFSET_SIZE;

export const HEADER_SIZE_BYTES    = 8;

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
//   * P: 16-bit padding
//
// GC metadata:
//   MSB [XXXX_XXMA] LSB
//
//     * A: alloc'd bit
//     * M: mark bit
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
    const b = this.memory[this.headerStart + HEADER_OFFSET_TAG];
    return BigInt.asUintN(8, BigInt(b)) as HeapTag;
  }

  setTag(tag: HeapTag) {
    this.memory[this.headerStart + HEADER_OFFSET_TAG] = Number(tag);
  }

  getSize(): bigint {
    return readI32(this.memory, this.headerStart + HEADER_OFFSET_SIZE);
  }

  setSize(size: bigint) {
    writeI32(this.memory, this.headerStart + HEADER_OFFSET_SIZE, size);
  }

  alloc() {
    const offset = this.headerStart + HEADER_OFFSET_GC;
    const b = this.memory[offset];
    const nb = b | 0x1;
    this.memory[offset] = nb;
  }

  unalloc() {
    const offset = this.headerStart + HEADER_OFFSET_GC;
    const b = this.memory[offset];
    const nb = b & ~0x1;
    this.memory[offset] = nb;
  }

  isAlloced() {
    const offset = this.headerStart + HEADER_OFFSET_GC;
    const b = this.memory[offset];
    return Boolean((b & 0x1) === 0x1);
  }

  // NOTE(alex): assumes single-threaded to not need to lock the GC byte
  mark() {
    const offset = this.headerStart + HEADER_OFFSET_GC;
    const b = this.memory[offset];
    const nb = b | 0x2;
    this.memory[offset] = nb;
  }

  // NOTE(alex): assumes single-threaded to not need to lock the GC byte
  unmark() {
    const offset = this.headerStart + HEADER_OFFSET_GC;
    const b = this.memory[offset];
    const nb = b & ~0x2;
    this.memory[offset] = nb;
  }

  // NOTE(alex): assumes single-threaded to not need to lock the GC byte
  isMarked(): boolean {
    const offset = this.headerStart + HEADER_OFFSET_GC;
    const b = this.memory[offset];
    return Boolean((b & 0x2) === 0x2);
  }
}

// Allocator operations required by a mark-and-sweep GC
//// NOTE(alex:mm): allocators should consider 0x0 as an invalid pointer
//   * WASM initializes local variables to 0
//   * When adding local variable roots, we don't necessarily know if the
//     variable has been initialized. Thus, if we see a 0x0 pointer, ignore it
export interface MarkableAllocator extends H.Allocator {
  // ptr: 32-bit address of the START of the object (NOT the header)
  //
  // NOTE: The allocator MUST OWN ptr. To not do so is a logic error
  //
  // Returns the object's corresponding Header
  //
  // Throws an error if the allocator does not own ptr
  getHeader: (ptr: Pointer) => Header,

  // size: size of object in bytes (NOT including header/metadata)
  // tag: heap object tag to know how to traverse the object
  //
  // Allocates memory of the requested size
  //   * Allocates additional memory to store GC metadata, tag, and size
  //
  // Returns an untagged pointer to the start of the object's memory (not the header)
  // Returns the null pointer (0x0) if allocation failed
  gcalloc: (tag: HeapTag, size: bigint) => Pointer,

  // Scans the allocated objects for unmarked, allocated objects and frees them
  sweep: () => void,
}

export class RootSet {

  // Needed to prune global variables
  memory: Uint8Array;

  // Pointers TO global variables
  // NOTE(alex): declared this way so the GC can check the global variable at mark-time
  //   instead of relying on a copy of the value (ala local variable roots)
  globals: Set<Pointer>;

  // VALUES of local variables that are pointers
  // Necessary b/c we have no way to directly scan the WASM stack
  // NOTE(alex): Whenever a local is updated, this may also need to be updated
  locals: Set<Pointer>;

  captureTempsFlag: boolean;
  // VALUES of temporaries that are pointers
  // Necessary b/c we have no way to directly scan the WASM stack
  // NOTE(alex): Whenever a local is updated, this may also need to be updated
  temps: Set<Pointer>;

  constructor(memory: Uint8Array) {
    this.memory = memory;

    this.globals = new Set();
    this.locals = new Set();
    this.temps = new Set();

    this.captureTempsFlag = false;
  }

  addTemp(ptr: bigint) {
    if (ptr != 0x0n) {
      this.temps.add(ptr);
    }
  }

  captureTemps() {
    this.captureTempsFlag = true;
  }

  releaseTemps() {
    this.captureTempsFlag = false;
    this.temps = new Set();
  }

  addLocal(value: bigint) {
    if (isPointer(value)) {
      const ptr = extractPointer(value);
      if (ptr != 0x0n) {
        this.locals.add(ptr);
      }
    }
  }

  removeLocal(value: bigint) {
    if (isPointer(value)) {
      const ptr = extractPointer(value);
      this.locals.delete(ptr);
    }
  }

  releaseLocals() {
    this.locals = new Set();
  }

  // ptr: pointer TO the global variable in linear memory
  addGlobal(ptr: Pointer) {
    this.globals.add(ptr);
  }

  // Iterate through all roots
  // Global variables are pruned for pointers
  forEach(callback: (heapObjPtr: Pointer) => void) {

    // Scan global variables for pointers
    this.globals.forEach(globalVarAddr => {
      const globalVarValue = readI32(this.memory, Number(globalVarAddr));
      if (isPointer(globalVarValue)) {
        callback(extractPointer(globalVarValue));
      }
    });

    // Local set is already a set of pointers to heap values
    this.locals.forEach(localPtrValue => {
      callback(localPtrValue);
    });

    // Temp set is already a set of pointers to heap values
    this.temps.forEach(localPtrValue => {
      callback(localPtrValue);
    });
  }
}

/// Mark-and-sweep GC implementation
///   * Stop-the-world
///
/// Based on pseudo-code from:
///   The Garbage Collection Handbook: The Art of Automatic Memory Management (Chapman & Hall, 2012
export class MnS<A extends MarkableAllocator> {
  memory: Uint8Array;
  heap: A;
  roots: RootSet;

  constructor(memory: Uint8Array, heap: A) {
    this.memory = memory;
    this.heap = heap;
    this.roots = new RootSet(memory);
  }

  // Trace the object graph from roots, setting the 'Mark' bit of each reachable object
  //
  // NOTE(alex): assumes that the object graph to trace is entirely contained
  //   by this GC's heap
  //
  // NOTE(alex): assumes roots are always valid pointers
  //
  // TODO(alex): figure out how to handle marking across GC boundaries
  markFromRoots() {
    let worklist: Array<Pointer> = new Array();
    this.roots.forEach(root => {
      if (!this.isMarked(root)) {
        this.setMarked(root);
        worklist.push(root);

        this.trace(worklist);
      }
    });
  }

  // Trace the object graph based on the worklist
  // * Depth-first
  //
  // NOTE(alex): assumes 32-bit field sizes
  trace(worklist: Array<Pointer>) {
    while (worklist.length > 0) {
      const childPtr = worklist.pop();
      const headerRef = this.heap.getHeader(childPtr);
      const childSize = headerRef.getSize();
      const childTag = headerRef.getTag();

      switch (childTag) {
        case TAG_CLASS: {
          for (let fieldIndex = 0n; fieldIndex < childSize / 4n; fieldIndex++) {
            const fieldValue = this.getField(childPtr + BigInt(4) * fieldIndex);
            if (!isPointer(fieldValue)) {
              continue;
            }

            const fieldPtr = extractPointer(fieldValue);
            if (!this.isMarked(fieldPtr)) {
              this.setMarked(fieldPtr);
              worklist.push(fieldPtr);
            }
          }
          break;
        }

        case TAG_LIST: {
          throw new Error("TODO: trace list");
        }

        case TAG_STRING: {
          throw new Error("TODO: trace string");
        }

        case TAG_DICT: {
          throw new Error("TODO: trace dict");
        }

        case TAG_BIGINT: {
          throw new Error("TODO: trace bigint");
        }
      }

      throw new Error(`Trying to trace unknown heap object: ${childTag.toString(16)}`);
    }
  }

  getField(fieldAddress: Pointer): bigint {
    let x = BigInt.asUintN(32, 0x0n);

    // WASM stores integers in little-endian:
    //   LSB at the smallest address
    for (let i = 0; i < 4; i++) {
      const b = BigInt(this.memory[Number(fieldAddress) + i]);
      x = x + (b << BigInt(8 * i));
    }

    return x;
  }

  isMarked(child: Pointer): boolean {
    const headerRef = this.heap.getHeader(child);
    return headerRef.isMarked();
  }

  setMarked(child: Pointer) {
    const headerRef = this.heap.getHeader(child);
    headerRef.mark();
  }

  // Traverses the owned heap, freeing objects that are allocated but not marked
  sweep() {
    this.heap.sweep();
  }

  // Try to make space in the heap
  collect() {
    this.markFromRoots();
    this.sweep();
  }

  // size: size of object in bytes (NOT including header/metadata)
  // tag: heap object tag to know how to traverse the object
  //
  // Allocates memory of the requested size
  //   * May also allocate additional memory to store GC metadata, tag, and size
  //   * May pause the user program in order to collect garbage
  //
  // Returns an untagged pointer to the start of the object's memory (not the header)
  // Returns the null pointer (0x0) if memory allocation failed
  gcalloc(tag: HeapTag, size: bigint): Pointer {
    let result = this.heap.gcalloc(tag, size);
    if (result === 0x0n) {
      this.collect();
      result = this.heap.gcalloc(tag, size);
    }

    if (this.roots.captureTempsFlag) {
      if (result !== 0x0n) {
        this.roots.addTemp(result);
      }
    }

    return result;
  }
}

/// ==========================================
/// GC-able wrappers for allocator combinators
/// ==========================================
///
/// NOTE(alex): copy/paste because we don't have typeclasses Q.Q

export class MarkableSwitch<P extends MarkableAllocator, F extends MarkableAllocator> implements MarkableAllocator {
  allocator: H.Switch<P, F>;

  constructor(p: P, f: F) {
    this.allocator = new H.Switch(p, f);
  }

  alloc(size: Pointer): Block {
    return this.allocator.alloc(size);
  }

  free2(ptr: Pointer) {
    return this.allocator.free2(ptr);
  }

  owns(ptr: Pointer): boolean {
    return this.allocator.owns(ptr);
  }

  description(): string {
    return this.allocator.description();
  }

  setFlag(f: boolean) {
    this.allocator.setFlag(f);
  }

  toggleFlag() {
    this.allocator.toggleFlag();
  }

  getHeader(ptr: Pointer): Header {
    if (!this.allocator.owns(ptr)) {
      throw new Error(`${this.allocator.description()} does not own pointer: ${ptr.toString(16)}`);
    }
    if (this.allocator.primary.owns(ptr)) {
      return this.allocator.primary.getHeader(ptr);
    } else {
      return this.allocator.fallback.getHeader(ptr);
    }
  }

  gcalloc(tag: HeapTag, size: bigint): Pointer {
    if (this.allocator.flag) {
      return this.allocator.fallback.gcalloc(tag, size);
    } else {
      return this.allocator.primary.gcalloc(tag, size);
    }
  }

  sweep(): void {
    this.allocator.primary.sweep();
    this.allocator.fallback.sweep();
  }
}

export class MarkableSegregator<S extends MarkableAllocator, L extends MarkableAllocator>
  implements MarkableAllocator {
  allocator: H.Segregator<S, L>;

  constructor(sizeLimit: bigint, s: S, l: L) {
    this.allocator = new H.Segregator(sizeLimit, s, l);
  }

  alloc(size: Pointer): Block {
    return this.allocator.alloc(size);
  }

  free2(ptr: Pointer) {
    return this.allocator.free2(ptr);
  }

  owns(ptr: Pointer): boolean {
    return this.allocator.owns(ptr);
  }

  description(): string {
    return this.allocator.description();
  }

  getHeader(ptr: Pointer): Header {
    if (!this.allocator.owns(ptr)) {
      throw new Error(`${this.allocator.description()} does not own pointer: ${ptr.toString(16)}`);
    }
    if (this.allocator.small.owns(ptr)) {
      return this.allocator.small.getHeader(ptr);
    } else {
      return this.allocator.large.getHeader(ptr);
    }
  }

  gcalloc(tag: HeapTag, size: bigint): Pointer {
    if (size <= this.allocator.sizeLimit) {
      return this.allocator.small.gcalloc(tag, size);
    } else {
      return this.allocator.large.gcalloc(tag, size);
    }
  }

  sweep(): void {
    this.allocator.small.sweep();
    this.allocator.large.sweep();
  }
}

export class MarkableDescriber<A extends MarkableAllocator> implements MarkableAllocator {
  allocator: H.Describer<A>;

  constructor(a: A, d: string) {
    this.allocator = new H.Describer(a, d);
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
    return this.allocator.description();
  }

  getHeader(ptr: Pointer): Header {
    if (!this.allocator.owns(ptr)) {
      throw new Error(`${this.allocator.description()} does not own pointer: ${ptr.toString(16)}`);
    }
    return this.allocator.allocator.getHeader(ptr);
  }

  gcalloc(tag: HeapTag, size: bigint): Pointer {
    return this.allocator.allocator.gcalloc(tag, size);
  }

  sweep(): void {
    this.allocator.allocator.sweep();
  }
}

export class MarkableFallback<P extends MarkableAllocator, F extends MarkableAllocator>
  implements MarkableAllocator {

  allocator: H.Fallback<P, F>;

  constructor(primary: P, fallback: F) {
    this.allocator = new H.Fallback(primary, fallback);
  }

  alloc(size: Pointer): Block {
    return this.allocator.alloc(size);
  }

  free2(ptr: Pointer) {
    return this.allocator.free2(ptr);
  }

  owns(ptr: Pointer): boolean {
    return this.allocator.owns(ptr);
  }

  description(): string {
    return this.allocator.description();
  }

  getHeader(ptr: Pointer): Header {
    if (!this.allocator.owns(ptr)) {
      throw new Error(`${this.allocator.description()} does not own pointer: ${ptr.toString(16)}`);
    }
    if (this.allocator.primary.owns(ptr)) {
      return this.allocator.primary.getHeader(ptr);
    } else {
      return this.allocator.fallback.getHeader(ptr);
    }
  }

  gcalloc(tag: HeapTag, size: bigint): Pointer {
    const b1 = this.allocator.primary.gcalloc(tag, size);
    if (b1 === 0x0n) {
      return this.allocator.fallback.gcalloc(tag, size);
    }

    return b1;
  }

  sweep(): void {
    this.allocator.primary.sweep();
    this.allocator.fallback.sweep();
  }
}

function readI32(memory: Uint8Array, start: number): bigint {
  let x = BigInt.asUintN(32, 0x0n);

  // WASM stores integers in little-endian:
  //   LSB at the smallest address
  for (let i = 0; i < 4; i++) {
    const b = BigInt(memory[start + i]);
    x = x + (b << BigInt(8 * i));
  }

  return x;
}

function writeI32(memory: Uint8Array, start: number, value: bigint) {
  // WASM stores integers in little-endian:
  //   LSB at the smallest address
  for (let i = 0; i < 4; i++) {
    const b = BigInt.asUintN(8, value >> BigInt(8 * i));
    memory[start + i] = Number(b);
  }
}
