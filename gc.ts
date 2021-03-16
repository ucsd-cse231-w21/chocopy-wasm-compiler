import * as H from "./heap";
import { Block, NULL_BLOCK } from "./heap";
import { extractPointer, isPointer, Pointer, StackIndex } from "./alloc";
import { throws } from "assert";

export type HeapTag =
  | typeof TAG_CLASS
  | typeof TAG_CLOSURE
  | typeof TAG_LIST
  | typeof TAG_STRING
  | typeof TAG_DICT
  | typeof TAG_BIGINT
  | typeof TAG_REF
  | typeof TAG_DICT_ENTRY
  | typeof TAG_TUPLE
  | typeof TAG_OPAQUE;

// FIXME: This should really be an enum...
export const TAG_CLASS = 0x1n;
export const TAG_LIST = 0x2n;
export const TAG_STRING = 0x3n;
export const TAG_DICT = 0x4n;
export const TAG_BIGINT = 0x5n;
export const TAG_REF = 0x6n;
export const TAG_DICT_ENTRY = 0x7n;
export const TAG_CLOSURE = 0x8n;
export const TAG_TUPLE = 0x9n;
export const TAG_OPAQUE = 0x12n; // NOTE(alex:mm) needed to mark zero-sized-types

// NOTE(alex:mm): controls whether any GC is ever run
// Set to false to disable GC (meaning memory allocations will always accumulate)
// Mainly for debugging purposes and as a fail-safe for unexpected bugs
export const ENABLE_GC = true;

// Offset in BYTES
const HEADER_OFFSET_TAG = 0x0;
const HEADER_OFFSET_GC = 0x1;
const HEADER_OFFSET_SIZE = 0x4;

export const HEADER_SIZE_BYTES = 8;

//
// Proxy for constructed GC object headers
//
// Layout (byte addresses):
//   0  [TGPPSSSS...]                             END
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
  getHeader: (ptr: Pointer) => Header;

  // size: size of object in bytes (NOT including header/metadata)
  // tag: heap object tag to know how to traverse the object
  //
  // Allocates memory of the requested size
  //   * Allocates additional memory to store GC metadata, tag, and size
  //
  // Returns an untagged pointer to the start of the object's memory (not the header)
  // Returns the null pointer (0x0) if allocation failed
  gcalloc: (tag: HeapTag, size: bigint) => Pointer;

  // Scans the allocated objects for unmarked, allocated objects and frees them
  sweep: () => void;

  // Allocated memory in bytes (not including any metadata)
  memoryUsage: () => bigint;
}

export class RootSet {
  // Needed to prune global variables
  memory: Uint8Array;

  // Pointers TO global variables
  // NOTE(alex): declared this way so the GC can check the global variable at mark-time
  //   instead of relying on a copy of the value (ala local variable roots)
  globals: Set<Pointer>;

  // Map of local variable stack location to the VALUES of local variables
  // Organized in a shadow "stack frame"
  //
  // Necessary b/c we have no way to directly scan the WASM stack
  // NOTE(alex): Whenever a local is updated, this may also need to be updated
  // NOTE(alex): Need to use a Map instead of a Set due to updating aliasing locals
  localsStack: Array<Map<StackIndex, Pointer>>;

  captureTempsFlag: boolean;

  // VALUES of temporaries that are pointers arranged in a "statement frame"
  // Necessary b/c we have no way to directly scan the WASM stack
  //
  // Assumes by the end of a statement, temporary objects generated by that statement
  //   are either:
  //   1) rooted by the statement (e.g. assignment)
  //   2) garbage
  //
  // Typically, `captureTemps()` and `releaseTemps()` should surrond each statement
  // EXCEPTION: return statements call neither because their temp objects should be
  //   placed in the caller's temp. frame
  //
  tempsStack: Array<Set<Pointer>>;

  // Holds the temporary set of a function call expression
  tempPlacementStack: Array<number>;

  constructor(memory: Uint8Array) {
    this.memory = memory;

    this.globals = new Set();
    this.localsStack = [];
    this.tempsStack = [];
    this.tempPlacementStack = [];

    this.captureTempsFlag = false;
  }

  returnTemp(value: bigint) {
    if (this.tempPlacementStack.length === 0) {
      throw new Error("Unable to find a temp set to return a value to");
    }

    const index = this.tempPlacementStack[this.tempPlacementStack.length - 1];
    if (index >= this.tempsStack.length) {
      throw new Error(
        `Attempting to use temp frame ${index}. Stack length: ${this.tempsStack.length}`
      );
    }
    if (this.tempsStack[index] === undefined) {
      let msg = "[";
      this.tempsStack.forEach((v) => {
        msg = msg.concat(`${index},`);
      });
      msg = msg.concat("]");
      throw new Error(`Bad temps stack: ${msg} (len=${this.tempsStack.length}, index=${index})`);
    }
    this.tempsStack[index].add(value);
  }

  addTemp(value: bigint) {
    if (isPointer(value)) {
      const ptr = extractPointer(value);
      if (ptr != 0x0n) {
        this.tempsStack[this.tempsStack.length - 1].add(ptr);
      }
    }
  }

  captureTemps() {
    this.captureTempsFlag = true;
    this.tempsStack.push(new Set());
  }

  pushCaller() {
    const target = this.tempsStack.length - 1;
    if (target < 0) {
      throw new Error(`Bad caller push: ${target}`);
    }
    this.tempPlacementStack.push(target);
  }

  popCaller() {
    if (this.tempPlacementStack.pop() === undefined) {
      throw new Error("Popping an empty temp placement stack");
    }
  }

  releaseTemps() {
    if (this.tempsStack.pop() === undefined) {
      throw new Error("Popping an empty temp root stack");
    }
    this.captureTempsFlag = this.tempsStack.length > 0;
  }

  pushFrame() {
    this.localsStack.push(new Map());
  }

  addLocal(index: bigint, value: bigint) {
    if (this.localsStack.length === 0) {
      throw new Error("No local stack frame to push to");
    }
    if (isPointer(value)) {
      const ptr = extractPointer(value);
      if (ptr != 0x0n) {
        this.localsStack[this.localsStack.length - 1].set(index, ptr);
      }
    }
  }

  removeLocal(value: bigint) {
    if (isPointer(value)) {
      const ptr = extractPointer(value);
      this.localsStack[this.localsStack.length - 1].delete(ptr);
    }
  }

  releaseLocals() {
    if (this.localsStack.pop() === undefined) {
      throw new Error("Popping an empty local root stack");
    }
  }

  // ptr: pointer TO the global variable in linear memory
  addGlobal(ptr: Pointer) {
    this.globals.add(ptr);
  }

  // Iterate through all roots
  // Global variables are pruned for pointers
  forEach(callback: (heapObjPtr: Pointer) => void) {
    // Scan global variables for pointers
    this.globals.forEach((globalVarAddr) => {
      const globalVarValue = readI32(this.memory, Number(globalVarAddr));
      if (isPointer(globalVarValue)) {
        const ptr = extractPointer(globalVarValue);
        if (ptr !== 0n) {
          // console.warn(`Global pointer at ${globalVarAddr}: ${ptr}`);
          callback(ptr);
        }
      }
    });

    // Local set is already a set of pointers to heap values
    this.localsStack.forEach((frame) => {
      // second value is the local index
      frame.forEach((localPtrValue, _) => {
        if (localPtrValue !== 0n) {
          // console.warn(`Local pointer: ${localPtrValue}`);
          callback(localPtrValue);
        }
      });
    });

    // Temp set is already a set of pointers to heap values
    this.tempsStack.forEach((frame) => {
      frame.forEach((localPtrValue) => {
        if (localPtrValue !== 0n) {
          // console.warn(`Temp pointer: ${localPtrValue}`);
          callback(localPtrValue);
        }
      });
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
    let worklist: Array<Pointer> = [];
    this.roots.forEach((root) => {
      // console.warn(`Checking root: ${root}`);
      if (!this.isMarked(root)) {
        // console.warn(`Tracing root: ${root}`);
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
      // console.warn(`Attempting to trace ${childPtr}`);
      const headerRef = this.heap.getHeader(childPtr);
      const childSize = headerRef.getSize(); // in bytes
      const childTag = headerRef.getTag();
      headerRef.mark();
      // console.warn(`Tracing ${childPtr} (tag=${childTag}, size=${childSize}, header=${headerRef.headerStart})`);
      const childValue = readI32(this.memory, Number(childPtr));
      // console.warn(`\tValue=${childValue}`);

      // NOTE(alex:mm): using a `switch` here breaks occasionally for whatever reason
      if (childTag === TAG_CLASS || childTag === TAG_TUPLE) {
        // classes and tuples use the same memory structure: a value at each memory position
        // NOTE(alex:mm): use field indices for debug info later
        for (let fieldIndex = 0n; fieldIndex < childSize / 4n; fieldIndex++) {
          const fieldValue = this.getField(childPtr + 4n * fieldIndex);
          if (!isPointer(fieldValue)) {
            continue;
          }

          const fieldPointerValue = extractPointer(fieldValue);
          if (fieldPointerValue !== 0n && !this.isMarked(fieldPointerValue)) {
            this.setMarked(fieldPointerValue);
            worklist.push(fieldPointerValue);
          }
        }
      } else if (childTag === TAG_LIST) {
        // Layout: [32-bit TAG_LIST, 32-bit <length>, 32-bit <capacity>, data...]

        // Extract value at childPtr + 4. Assumed to be a primitive value
        const listLength = readI32(this.memory, Number(childPtr + 4n));
        // console.warn(`Scanning list of length ${listLength}`);

        // Sanity check, just-in-case
        // NOTE(sagar): probably not necessary
        // NOTE(alex:MM): list length is PROBABLY an UNTAGGED value
        // TODO(alex:mm): verify that this is the case
        // if(isPointer(listLength)) {
        //   throw new Error("Pointer value stored in the place of list length");
        // }

        // Note(sagar): Memory layout is abstracted by allocator
        // childPtr always points to start of data, not header
        const dataBase = childPtr + 12n;
        for (let dataPtr = dataBase; dataPtr < dataBase + listLength; dataPtr += 4n) {
          const elementValue = this.getField(dataPtr);

          if (isPointer(elementValue)) {
            const fieldPointerValue = extractPointer(elementValue);
            // Check for None
            if (fieldPointerValue !== 0n && !this.isMarked(fieldPointerValue)) {
              this.setMarked(fieldPointerValue);
              worklist.push(fieldPointerValue);
            }
          }
        }
      } else if (childTag === TAG_STRING || childTag === TAG_BIGINT) {
        // Just mark the pointer?
        this.setMarked(childPtr);
      } else if (childTag === TAG_DICT) {
        // console.warn(`Tracing a dictionary at ${childPtr}`);
        // NOTE(alex:mm): dictionaries are a contiguous array of pointers to TAG_DICT_ENTRY items
        //   Currently hard-coded to 10 buckets
        //   If bucket count is run-time adjustable, need to update this traversal
        const dataStart = childPtr;
        const dataEnd = dataStart + childSize;
        for (let listIndex = dataStart; listIndex < dataEnd; listIndex += 4n) {
          // NOTE(sagar): always assumed to be an address. Unnecessary to check
          let currListAddr = this.getField(listIndex);
          // console.warn(`listIndex=${listIndex}, currListAddr=${currListAddr}`);
          if (currListAddr !== 0n) {
            worklist.push(currListAddr);
          }
        }
      } else if (childTag === TAG_DICT_ENTRY) {
        // console.warn(`Tracing dict entry at ${childPtr}`);
        // NOTE(alex:mm): Assuming layout
        //   childPtr => [k, v, next] <= childPtr + 12
        const key = this.getField(childPtr + 0n);
        const value = this.getField(childPtr + 4n);
        const next = this.getField(childPtr + 8n);
        // NOTE(sagar): keys probably can't be None
        if (key !== 0n && isPointer(key)) {
          worklist.push(key);
        }

        // Check for none
        if (value !== 0n && isPointer(value)) {
          worklist.push(value);
        }

        if (next !== 0n && isPointer(next)) {
          worklist.push(next);
        }
      } else if (childTag === TAG_REF) {
        // NOTE(alex:mm): assume a single value
        // TODO(alex:mm): TAG_REF can be potentially be merged with TAG_CLASS
        const value = readI32(this.memory, Number(childPtr));
        if (isPointer(value) && value !== 0n) {
          const pointerValue = extractPointer(value);
          worklist.push(pointerValue);
        }
      } else if (childTag === TAG_CLOSURE) {
        // Layout [32-bit fn table-index, boxed-values...]
        this.setMarked(childPtr);
        const childSize = headerRef.getSize(); // in bytes
        const boxedRefsSize = childSize - 4n;
        // console.warn(`TAG CLOSURE {size=${childSize}}`);

        const dataBase = childPtr + 4n;
        for (let dataPtr = dataBase; dataPtr < dataBase + boxedRefsSize; dataPtr += 4n) {
          const value = readI32(this.memory, Number(dataPtr));
          // console.warn(`Value: ${value}`);
          if (isPointer(value) && value !== 0n) {
            const pointerValue = extractPointer(value);
            worklist.push(pointerValue);
          }
        }
      } else if (childTag === TAG_OPAQUE) {
        // NOP
      } else {
        throw new Error(
          `Trying to trace unknown heap object: { addr=${childPtr}, tag=${(childTag as any).toString()}, size=${childSize} }`
        );
      }
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
    if (!ENABLE_GC) {
      console.error(`Unable to run the GC. ENABLE_GC is not set to true`);
      return;
    }
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
    if (size === 0n) {
      throw new Error(`Cannot GC allocate size of 0`);
    }

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
    // console.warn(`Allocating ${size} at ${result} (tag=${tag})`);

    return result;
  }
}

/// ==========================================
/// GC-able wrappers for allocator combinators
/// ==========================================
///
/// NOTE(alex): copy/paste because we don't have typeclasses Q.Q

export class MarkableSwitch<P extends MarkableAllocator, F extends MarkableAllocator>
  implements MarkableAllocator {
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

  memoryUsage(): bigint {
    return this.allocator.primary.memoryUsage() + this.allocator.fallback.memoryUsage();
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
      throw new Error(`${this.allocator.description()} does not own pointer: ${ptr.toString()}`);
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

  memoryUsage(): bigint {
    return this.allocator.small.memoryUsage() + this.allocator.large.memoryUsage();
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

  memoryUsage(): bigint {
    return this.allocator.allocator.memoryUsage();
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

  memoryUsage(): bigint {
    return this.allocator.primary.memoryUsage() + this.allocator.fallback.memoryUsage();
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
