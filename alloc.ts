import * as Heap from './heap';
import * as GC from './gc';

class Allocator {
  globalAllocator: Heap.BumpAllocator,
  // In the future, we can do something like
  // globalAllocator: Fallback<BumpAllocator, Generic>
  gc: SomethingElse,

  constructor(globalStorage: bigint) {
    this.globalAllocator = new BumpAllocator(0, globalStorage);
  }
}
