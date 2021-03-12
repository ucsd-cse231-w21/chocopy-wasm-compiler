# March 11 Goals
We expect all example programs to execute with safety of conservative collection and GC completeness by March 11 (except program 7).

Currently all programs utilize a `BumpAllocator` heap for allocation so we have feature parity with the base-line ChocoPy WASM compiler. The next task would be to swap to heap implementation with a more complicated one based on allocator combinators, bit-mapped blocks, and free lists.

# Biggest Challenges
* Design for heap allocators
  * Understanding the underlying data structures for bit-mapped blocks and freelists
  * Implementing the GC operations on top of the primitives was relatively simple

* Object rooting
  * WASM does not support inspection of the WASM stack
  * GC needs to implement its own shadow stacks that track local variables, temporaries, and function calls itself in order to see what local/temp objects are live
  * We want objects (especially temporary objects) to be considered "rooted" for the shortest time possible
  * Temporary object lifetimes are tied to statements
    * Return statements place temporaries in the calling statement's temporary frame
    * Otherwise, place temporaries in the current statement's frame
  * Local variables are tied to function definitions
    * The local root set is updated whenever a local is updated
    * Locals are only freed at the end of the function call
    * No liveness analysis performed (all at runtime)
  * The compiler notifies the GC about global variables during codegen
    and are scanned at runtime for pointers

# Future Extensions

## Handling Memory Fragmentation
The following example program results in memory fragmentation:
```
class Foo(object):
  a: int = 0
  b: int = 0

class Bar(object):
  a: int = 0
  b: int = 0
  c: int = 0

f1: Foo = None
f2: Foo = None
f3: Foo = None
b1: Bar = None

f1 = Foo()
f2 = Foo()
f3 = Foo()
f2 = None

b1 = Bar()
```

When f2 is set to `None`, a hole of size `Foo` is left in memory. However, `b1`'s `Bar` is allocated after the third `Foo` and is larger than `Foo` so it cannot fill in the gap.

Handling memory fragmentation requires a copying or compacting GC which requires being able to rewrite pointers. Pointer rewriting is possible for heap-allocated values but introduces a lot of overhead when dealing with local variables because we cannot modify the WASM stack.

The alternative would be to heap allocate stack frames so we can scan and modify them ourselves. Until WASM adopts the support we need, such workarounds would be necessary.

## Precise Local Rooting
The following program may lead to an unnecessary `Out of Memory` error:
```
class Big:
  ...

class Small:
  ...

def foo() -> int:
  i: int = 0
  big: Big = None
  # Hidden addLocal(2, PTR) call
  big = Big()
  useBig(big)
  # Need big = None in order to release memory

  while i < 100000:
    work(Small())

  return i

foo()
```

Local variables are assumed to live until the end of the function. However, that may lead to pseudo memory leaks because a variable may only be used for a portion of the function and dead for the rest. Without the user explicitly `None`-ing out the pointer, memory will essentially be leaked until the end of the function.

Solving this problem requires precise rooting of local variables through liveness analysis.

## Limiting GC Pause Times
The current GC design is a stop-the-world mark-and-sweep GC that scans the entire heap every execution. Assuming a large heap (4+ gigabytes), this can get very expensive and slow down the user program. To reduce pause times we can:
* Implement a generational GC. This builds upon the idea of a copying/moving GC to separate the heaps into smaller generations that can be collected independently.
* Implement concurrent sweeping. This is probably not an option for JavaScript but being able to scan the heap while the user program is running would reduce the noticeable impact of the GC.
