import * as Heap from './heap';
import * as GC from './gc';

class Allocator {
  globalAllocator: Heap.BumpAllocator;
  // In the future, we can do something like
  // globalAllocator: Fallback<BumpAllocator, Generic>
  gc: GC.MnS;

  constructor(globalStorage: bigint) {
    this.globalAllocator = new Heap.BumpAllocator(0n, globalStorage);
  }
}
