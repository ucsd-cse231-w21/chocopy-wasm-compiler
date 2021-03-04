# ChocoPy: Built-in Libraries Proposal
At the moment, our dialect of ChocoPy only supports a small subset of the total variety of built-in and libraries functions that is in the Python Standard. The following proposal aims to allow a general pathway to define new libraries for users to interact with.

## File Changes
In `ast.ts`, there's no structure that allows for `import` statements to be described. To address this problem, we must implement a few changes to `Stmt` as described:
`{ a?: A, tag: "import" , fileName: string }`
`{ a?: A, tag: "from" , fileName: string, target: string }`

These two changes should allow for the expression of `import <filename>` and `from <filename> import <funcName/className/variableName>`

## File Additions
As this proposal aims to allow developers to add their own "built-in" library modules, it's important that we keep such modules in one directory.

We'll be adding a new directory called `b_modules` in the root directory.

## Addition of `b_modules/built_funcs.ts`
For the subset of built-in functions that our dialect of ChocoPy implements - `abs`, `print` , `max`, `min` , etc. - we'll be adding all such functions in the `BFunc` class in `built_funcs.ts`

## Addition of `builtin.ts`
This file will contain all necessary types and functions related to accessing, invoking and mutating built-in modules. 

Notably, this file will contain the `BuiltInModule` interface which contains the function: `initialize()` . The purpose of this function is to initialize a module's variables when the module is imported (assuming it has not already been)

## Addition of `runtime.ts`
This file will contain the management of memory, notably the accessing of global variables and allocation (and deallocation) of heap data. 

**Memory Layout** goes into futher details about `runtime.ts`'s role

## Memory Layout
Global variables will be allocated and stored using an array in `runtime.ts` . This structure will map a global variable's index - which is generated during WASM code generation - to a dictionary containing the variable's declared type, string name and actual value - represented as a `Value` instance.

Heap objects will be allocated similarly, with objects represented as `Instance` instances that hold an object's type name and a `array` that represents the object's instance variables.

This memory layout is essential as imported modules will be represented as objects. When a module is imported, the runtime will invoke the `initialize()` method of the corresponding TypeScript class of that module and allocate an `Instance` instance that holds that module's global variables. 

## Example Programs
Using the changes listed in this proposal, we aim to make the following example programs run according to expectations:

```
print(10)
```

```
print(None)
```

```
print(True)
print(False)
```


```
import someModule
print(someModule.func()) #Assume func() returns 10
```

```
import someModule
print(someModule.func())
import someNodule   #Should not re-inialize someModule
```

```
from someModule import func
print(func() ) #should work as before 
```

```
from someModule import func1
func1()  #should invoke func1 in someModule
```

```
from someModule import func1, func2
func1()   #should invoke func1 in someModule
func2()   #should invoke func2 in someModule
```

```
from someModule import SomeClass
x: SomeClass = SomeClass()  #should instantiate SomeClass in someModule
```

```
from someModule import SomeClass
x: SomeClass = SomeClass()  #should instantiate SomeClass in someModule
x.method()   #Should invoke method() in SomeClass
```