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
