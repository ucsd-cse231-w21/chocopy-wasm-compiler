# Closures/First Class/Anonymous Functions
Project Proposals and Starting Points


## 10 representative example programs

1. Trivial nested function without escape  
In this example, `inc` should be compiled as a wasm function with an internal name consisting of both the inner and outer function names (e.g. `$f_inc`). The result is expected to be 6
    ``` python
    def f(x: int) -> int:
      def inc() -> int:
        return x + 1
      return inc()
    f(5)
    ```

2. Trivial `nonlocal` usage  
In this example, `x` will be wrapped in a “reference” object in the heap memory, and both `g` and `h` are flatten (converted to top level functions) by adding additional arguments to `g` and `h` respectively. The expected result is 35.
    ``` python
    def f(x : int) -> int:
      def g(y : int) -> int:
        return x + h(y) 
      def h(z : int) -> int:
        nonlocal x
        x = z
        return x + 1
      return g(10) + g(7)
    f(6)
    ```

3. A trivial case where `nonlocal` can be eliminated  
In this example, `x` is not nonlocally mutable and will be an unwrapped extra argument of function `g`.
    ``` python
    def f() -> int:
        x: int = 0
        def g() -> int:
            nonlocal x
            return x + 1
        return g()
    f()
    ```

4. Trivial lambda expression  
In this example, a generated name (e.g. `$f_lambda_n`, where n is unique) is used for a wasm the function. The variables `f1` and `f2` will store function reference values (table indices) of the generated anonymous function. Besides, the test needs to check the tc result, making sure that `a` is inferred as an int. The expected result is 30.
    ``` python
    def f(x: int) -> int:
        f1: Callable[[int], int] = None
        f2: Callable[[int], int] = None
        f1 = lambda a : a + 10
        f2 = f1
        return f1(x) + f2(x)
    f(5)
    ```

5. A Trivial example of closure from lecture notes (function escapes when it is returned)  
In this example, we’ll transform `g` into a class named as e.g. `$closure_f_g`, with a field for each nonlocal variable and an `apply` method. Function `f` would instantiate an object of that closure class and initialize its fields at appropriate time.
    ``` python
    def f(x : int)->Callable[[int],int]:
      def g(y : int) -> int:
        return x + y
      return g

    g_where_x_is_6: Callable[[int],int] = None
    g_where_x_is_6 = f(6)
    print(g_where_x_is_6(5))
    ```

6. Closure with variable of object type  
This example is to make sure that python objects work well with closures. The result of the program should be `24`.
    ``` python
    class A(object):
      x:int = 1

    def f(a:A)->Callable[[int],int]:
      def g(y: int) -> int:
        a.x = a.x + y
        return a.x
      return g

    a:A = None
    g: Callable[[int], int] = None
    a = A()
    a.x = 6
    g = f(a)
    a.x = 10
    g(2) + a.x
    ```

7. A modified example from Feb 9 lecture (`nonlocal`, `inc`/`dec`) (multiple functions returned)  
This example program is modified from the example came up by a classmate in the Lecture of Feb 9, by adding a third function `curr` to inspect the current value of `x` avoiding the use of nonlocal keywords. The results of the last 4 expressions of the modified example should be 101, 100, 101, 101, which illustrate a situation where variables from outer scope without nonlocal (`x` in `curr`) also need to be wrapped.
    ``` python
    class Triplet(object):
      fst:Callable[[], int] = None
      snd:Callable[[], int] = None
      thd:Callable[[], int] = None


    def foo() -> Triplet:
      x: int = 0
      r: Triplet = None
      def inc() -> int:
        nonlocal x
        x = x + 1
        return x
      def dec() -> int:
        nonlocal x
        x = x -1
        return x
      def curr() -> int:
        return x
      r = Triplet()
      x = 100

      r.fst = inc
      r.snd = dec
      r.thd = curr
      
      return r

    ```

8. An non-escaping function passed to another function as a callable argument  
In this example, `g` is transformed into a class called e.g `$closure_f_g` and `f(10)` is an object of the closure class with type `Callable[[int],bool]`. Function `id` takes a closure of type `Callable[[int],bool]` as argument and returns a closure of the same type.
    ``` python
    def f(x : int) -> Callable[[int], bool]:
      def g(y : int) -> bool:
        return x > y
      return g

    def id(c : Callable[[int], bool]) -> Callable[[int], bool]:
      return c

    id(f(10))(5)
    ```

9. An escaping function passed to another function as a callable argument  
This is an example where a function takes another escaping callable as an argument. The result should be 3 and 5 respectively.
    ``` python
    class MyTupleInt(object):
      fst: int = 0
      snd: int = 0

    def add_n(x:int) -> Callable[[int], int]:
      def g(y:int)-> int:
        return x + y
      return g

    def map2(x: int, y: int, f: Callable[[int], int])-> MyTupleInt:
      t: MyTupleInt = None
      t = MyTupleInt()
      t.fst = f(x)
      t.snd = f(y)
      return t

    add_2: Callable[[int], int] = None
    r: MyTupleInt = None

    add_2 = add_n(2)
    r = map2(3, 5, add_2)
    r.fst
    r.snd
    ```

10. An example from Feb 16 lecture (an escaping function calls its non-escaping sibling)  
This example is a copy of the problem discussed in the Feb 16th lecture, where we avoid making `h` escaping by first adding extra arguments to “known” functions and then create closures with free variables in escaping functions. This test should check the result of escaping analysis and make sure `h` is treated as a simple wasm function (non-escaping).
    ``` python
    def f(x:int) -> Callable[[], int]:
        def g() -> int:
            return h()
        def h() -> int:
            return x + 1
        return g

    f(10)()
    ```

## How we will add tests for your feature
We will check the test cases’ final outputs, results of type checking and intermediate ASTs generated from escaping analysis. In addition, test cases for scenarios where syntax, type and runtime error are arised are covered.

## New AST forms planing to add
``` typescript
export type Type = 
    ...
	| { tag: “callable”, args: Array<Type>, ret: Type }

export type Scope<A> 
  = { a?: A, tag: "global", name: string}
  | { a?: A, tag: "nonlocal", name: string}

export type FunDef<A> = {
	a?: A,
	name: string,
	parameters: Array<Parameter<A>>,
	ret: Type,
  decls: Array<Scope<A>>,
	inits: Array<VarInit<A>>,
	funs: Array<FunDef<A>>,
	body: Array<Stmt<A>>
}

export type VarInit<A> = 
  | { a?: A, name: string, type: Type, value: Literal }

export type Expr<A> = ...
	// note that Python's type hint does not annotate lambda
	// However, it does allow fancy calling (e.g. opt args)
	// TODO: talk to fancy calling conventions group about this 
	| { tag: "lambda", args: string[], ret: Expr<A> }

export type Value = 
    ...
	| { tag: "callable", name: string, addr: number } // closure
```

## New functions, datatypes, and/or files added to the codebase

- eair.ts
  ``` typescript
  // 'eair' stands for the intermedia representation after escaping analysis
  
  // Defines an AST that is similar to the input AST of ea (defined
  // in the following file) but without callable type, nested function
  // as well as nonlocal keywords, while other non-trivial changes 
  // (some of which might be useful for optimization) is listed.
  
  // nonlocals will be used as the parameters of the constructor
  // use the FunDef without nested function
  export type Closure<A> = 
	  { a?: A, name: string, nonlocals: Array<VarInit<A>>, apply: FunDef<A>> }
  
  // change case, TODO: design decisions to discuss
  export type Expr<A> = ...
	  | { a?: A, tag: "ref", name: string }
	  | { a?: A, tag: "fun_id", name: string }
  ```
 
- ea.ts
  ``` typescript
  type EaInput = ... // typed ast or ir from another group
  export function ea(ast: EaInput): eair.Program {
	  // escape analysis here
  }
  ```

## Changes to existing functions, datatypes, and/or files in the codebase
We need to change the `parser.ts` to support recursively parsing nested fucntions;
`tc.ts` for the new `callable` type and so on; `compiler.ts` to support the new features added.

## Value representation and memory layout for any new runtime values
The memory layout of closures and references should be as similar as that of class (reference wrapper and closure implemented as something like non-inheritable class). As for non-escaping functions using as values, they will be an i32 pointer pointing to the corresponding functions in the table.

## Milestone plan for March 4
We are going to commit on the fundamental feature 1 and 2 listed above by March 4.