# Project Propsal (Memory Management)

NOTE: references *The Garbage Collection Handbook Second Edition*

## Example Programs

### Program 1
```
x: int = 0
x = 1337
print(x)
```
The program should allocate a global variable `x` (initialized to 0), set the `x` to `1337` and then proceed to print it. The global variable `x` should NEVER be collected b/c it may be used by REPL entries.

### Program 2
```
class Foo(object):
  a: int = 0
  b: int = 0

x: Foo = None
X = Foo()
x.a = 1337

x = Foo()
x.a = 21
```

The program should allocate 2 `Foo` object, set the field `a`, and set `x` to point to the object. The old `Foo` object should *eventually* be freed such that it's memory can be reused.

### Program 3
```
class DList(object):
  prev: DList = None
  next: DList = None
  v: int = 0

d0: DList = DList()
d1: DList = DList()
d2: DList = DList()

d0.prev = d2
d0.next = d1

d1.prev = d0
d1.next = d2

d2.prev = d1
d2.next = d0b/c d0-d2 are globals
```
The program will allocate 3 DList objects that form a cycle in the object graph. This memory will not be reclaimed b/c d0-d2 are globals. The GC should not enter an infinite loop.

### Program 4
```
class DList(object):
  prev: DList = None
  next: DList = None
  v: int = 0

def test():
  d0: DList = DList()
  d1: DList = DList()
  d2: DList = DList()

  d0.prev = d2
  d0.next = d1

  d1.prev = d0
  d1.next = d2

  d2.prev = d1
  d2.next = d0

test()
```
The program will allocate 3 DList objects that form a cycle in the object graph. This memory will eventually be reclaimed after the `test()` function exits. The GC should not enter an infinite loop.

### Program 5
```
class Foo(object):
  a: int = 0
  f: Foo = None

x: object = None
X = Foo()
x.a = 1337
x.f = Foo()

x = Foo()
x.a = 21
```
The program should allocate 3 `Foo` object, set the field `a`, and set `x` to point to the object. The first 2 `Foo` object should *eventually* be freed such that it's memory can be reused.

### Program 6
```
### REPL 1
class Foo(object):
  a: int = 0
  f: Foo = None

x: object = None
x = Foo()
x.f = Foo()

### REPL 2
x = None
```
REPL 1 should allocate 2 `Foo` objects. The global `x` and the objects should persist across REPL entries. The 2 `Foo` objects are eventually freed after REPL 2 (while the global `x` is still allocated).

### Program 7
```
### REPL1
class Foo(object):
  a: int = 0
  f: Foo = None

f: Foo = None
f = Foo()
f.f = Foo()

x: [object] = None
x = [1, None, f]

### REPL2
x = None
```

REPL1 should allocate 2 `Foo` objects and a list. The global variable `x` points to that list which also references a `Foo` object. No memory is freed. After REPL2, the list and the 2 `Foo` objects should eventually be freed.

### Program 8
```
### REPL1
def f(x: int):
  def inc() -> int:
    nonlocal x
    x = x + 1
    return x

  return inc

i: Callable[(), int] = None
i = f(0)
print(i())      # 1
print(i())      # 2

### REPL2
i = None
```

REPL1 should allocate a `int` variable reference and a closure object (assigned to global `i`). No memory is freed. After REPL2, the variable reference and closure object should eventually be freed.

### Program 9
```
### REPL1
class Foo(object):
  a: int = 0

def f(x: int) -> Foo:
  f: Foo = None
  f.a = x
  return f

o: Foo = None
o = f(1337)

### REPL2
o = f(0)
```
REPL1 should call the function `f` which allocates a `Foo` object, returns it, and sets the global `o` to point towards that object. No memory is freed. REPL2 should call the function `f` which allocates another `Foo` and sets `o` to point towards it. The old `Foo` should eventually be freed after REPL2.

### Program 10
```
class Foo():
  a: int = 0

def wasteTime():
  x: int = 0
  f: Foo = None

  while x < 10000000000000:
    f = Foo()
    x = x + 1

wasteTime()
```
The program should call the function `wasteTime` which allocates 1 `Foo` object per loop which should be eventually freed after the iteration completes (the last `Foo` is eventually freed after the function exits). Total allocation may grow as the loop executes but should never overflow because `Foo` objects are being freed.

## Testing

Testing of the garbage collector is split into 2 parts: unit testing/mocking the garbage collector and integration testing with the compiler/language runtime. The primary invariant to test are:
1. The GC NEVER deallocates 'live' objects (safety of conservative collection)
2. The GC eventually deallocates 'dead' objects (GC completeness)

GC execution will be monitored but speedy GC is not an explicit goal.

Unit testing involves creating "fake" data in WASM linear memory (and fake globals/local variable) and running the garbage collector. Integration testing involves using the GC at runtime using compiler-generated info and code. In both cases, tests will check that the invariants listed above hold.

## AST Forms

None to add.

## Codebase Changes

New files:
* `alloc.ts`: defines the main allocator interface for runtime/compiler code
  * `ObjectTag`: defines possible heap object types
  * `MemoryManager`: class that composes the GC and heap implementations into a coherent unit
    * `gcalloc(tag: ObjectTag, size: BigInt32)`: allocates a new object in the GC heap and returns a pointer to the start of the object (not the header); may invoke the GC (stop-the-world)
    * `forceCollect()`: manually invoke the GC (stop-the-world)
    * `getTag(ptr)`: get heap object tag
    * `getSize(ptr)`: get heap object size (excluding header info)
* `heap.ts`: defines all allocator implementations/interfaces
  * `Allocator`: common interface for heap allocators
  * `BumpAllocator`: bump allocator heap implementation
  * `AllocList`: free-list heap implementation
  * `BitMappedBlocks`: bit-mapped block heap implementation
  * `Switch`: heap combinator that allows switching between primary/fallback allocators
  * `Segregator`: heap combinator chooses allocators depending on allocation size
  * `Describer`: heap combinator that can give more debug info to allocators
  * `Fallback`: heap combinator uses a primary allocator and switches to a fallback allocator when the primary fails
* `gc.ts`: defines all the GC implementations/interfaces
  * `Header`: proxy object for an object header
  * `MSGc`: class that defines a mark-and-sweep GC
  * `CopyingGc`: class that defines a copying GC
  * `MarkableAllocator`: interface for heaps that can be used by `MSGc`
  * `MarkableBitMappedBlocks`: class that wraps a `BitMappedBlocks` heap to provide a `MarkableAllocator` implementation (used to allocate/access object headers)
  * `MarkableAllocList`: class that wraps an `AllocList` heap to provide a `MarkableAllocator` implementation (used to allocate/access object headers)
* `tests/gc-unit-tests.test.ts`: defines the GC unit tests
* `tests/gc-int-tests.test.ts`: defines the GC integration tests

Changed files:
* `compiler.ts`:
  * Need to augment any heap allocation code to call the allocators/GC for memory
  * Need to track local variables and global variables for GC roots (and generate code to inform the GC) in `augmentEnv()` and `makeLocals()`
  * In `augmentEnv()`, we also need to generate code that sends type info to the GC for tracing

## Value Representation/Layouts
No new values are being added but value representations need to be modified to somehow track pointers.
Options:
1. Tag values (primitive vs pointer) and add size information to object headers. This allows a GC to linearly scan an object's fields for any pointers.
2. Box every object and place a special function in the vtable that tells the GC which fields are poiners.

Decision as of 2/25/2021: option 1 with 32 bit values, using the least significant bit as the tag.
* Primitives are tagged with `1`
* Pointers are tagged with `0`

## March 4 Milestone Plan
We plan to target programs 1 and 2 such that they execute properly.
