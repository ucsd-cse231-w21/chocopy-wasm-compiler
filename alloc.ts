import * as H from "./heap";
import * as GC from "./gc";

// Untagged pointer (32-bits)
export type Pointer = bigint;

export class MemoryManager {
  globalAllocator: H.BumpAllocator;
  memory: Uint8Array;
  // In the future, we can do something like
  // globalAllocator: Fallback<BumpAllocator, Generic>
  gc: GC.MnS<H.BumpAllocator>;

  constructor(memory: Uint8Array, globalStorage: bigint, total: bigint) {
    this.memory = memory;
    this.globalAllocator = new H.BumpAllocator(memory, 0n, globalStorage);
    const gcHeap = new H.BumpAllocator(memory, globalStorage, total);
    this.gc = new GC.MnS(memory, gcHeap);
  }
}
