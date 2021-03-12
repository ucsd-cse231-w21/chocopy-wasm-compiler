## 10 example programs:

### 1. One default
```
def add_default_10(x : int, y : int = 10) -> int:
	return x + y
	
add_default_10(20) // returns 30
add_default_10(20, 5) // returns 25
```
Function with parameters with and without defaults. If function calls do not include arguments for parameters with defaults, then the default value for that parameter is used.

### 2.  Multiple defaults
```
def add_defaults(x : int = 10, y : int = 20, z : int = 30) -> int:
	return x + y + z
add_defaults() // returns 60
add_defaults(40) // returns 90
```
Function with multiple parameters with defaults. All parameters should be initialized to their default value if no arguments are passed to this function. This program ensures that multiple default values work. We also need to make sure that arguments are placed in the correct position of the function call. (e.g. first argument is set to x, second is set to y)

### 3.  Keyword Argument
```
def subtraction(a : int, b : int) -> int:
	return a - b
subtraction(a = 10, b = 5) // returns 5
subtraction(b = 10, a = 5) // returns -5
```
Function with keyword arguments. By explicitly listing out the parameter name in the function call, you would be able to set those parameters regardless of its position in the arguments.

### 4.  Arbitrary Argument
```
// Requires loop iterators
def sum(*nums : int) -> int:
	temp : int = 0
	for num in nums:
	temp = temp + num
	return temp
sum() // returns 0
sum(1, 2, 3) // returns 6
```
Function with arbitrary arguments. We explicitly state in the function definition that the function should take an arbitrary number of integer arguments, and return the sum of these arguments. This program ensures that the function works with both zero and nonzero arguments. We should also test whether we correctly throw errors for incorrectly typed arbitrary arguments.

### 5.  Default is a construct
```
class Foo(object):
	bar : int = 7
	def set(self: Foo, bar: int) -> None:
		self.bar = bar
	def baz(x : int, foo : Foo = Foo()) -> int:
		return foo.bar + x
baz(5) // should return 12
```
Function that has an object as a default value. In this program, the parameter foo was initialized with the Foo class constructor without having to pass in the object to the function call.

### 6.  Keyword Arguments passed as dictionary
```
// Requires support for sets/dictionaries and list
def sum(**values) -> int:
	return_val : int = 0
	For key, value in values.items():
		return_val = return_val + value
	return return_val
sum({a=1, b=2, c=3}) // returns 6
```
Function with variable keyword arguments. In the function definition, an arbitrary number of keyword arguments are included explicitly as a dictionary, and we assume for this program that all of these keyword arguments are integers. This program should return the sum of the keyword arguments.

### 7.  Default inside class method
```
Class Foo(object):
	bar : int = 7
	def set(self: Foo, bar: int = 14) -> None:
		self.bar = bar
foo : Foo = None
foo = Foo()
foo.set() // foo.bar set to 14
foo.set(21) // foo.bar set to 21
```
This program tests the functionality of default parameters in calls to methods within a class. Similar to default parameters used in function definitions, we expect that calls to methods with unspecified default parameters should default to their default values.

### 8.  args inside class method (needs lists and iterators)
```
class Foo(object):
	bar : int[] = []
	def load(self: Foo, * args : int) -> None:
		for arg in args:
			self.bar.append(arg)
foo : Foo = None
foo = Foo()
foo.load(1, 2, 3, 4, 5)
print(foo.bar) // [1, 2, 3, 4, 5]
```
This program tests the functionality of arbitrary arguments in calls to methods within a class. Similar to arbitrary arguments used in function definitions, we expect that calls to methods with arbitrary parameters should be able to take any number of arguments with the specified type. In this case, the load method in Foo should take an arbitrary number of integer arguments.

### 9.  Default and args
```
def foo(base : int = 0, * args : int) -> int:
	for arg in args:
		base += arg
return base
foo(1, 2, 3, 4, 5) // should return 15
```
Combines default parameters with arbitrary arguments. We ensure that regular parameters and parameters with default values are defined before the arbitrary arguments.

### 10.  args and kwargs (needs strings, dicts, lists, iterators, destructors?)
```
def foo(* args, ** kwargs) -> None:
	for arg in args:
		print(arg)
	for key, value in kwargs.items():
		print(key)
		print(value)
foo(1, 2, 3, a = 4, b = 5, c = 6)

“””
1
2
3
a
4
b
5
c
6
“””
```
Combining arbitrary arguments with keyword arguments. The convention follows that arbitrary arguments are defined before the keyword arguments. For this program to work, we treat arbitrary arguments as a list and keyword arguments as a dictionary. Finally, there would need to be support for iterators for the program to walk through these list and dictionary structures.

## Tests:

### Default arguments
For default arguments, we will type check the literals defined at the function signature to make sure it matches the type of parameter. For function calls and method calls, we have to check the number of parameters passed in. The number of parameters passed in must be at least greater than the number of parameters without default values and less than the number of total parameters defined in the function signature. Then, those values in the function/method calls must be type checked.

### Arbitrary arguments
For arbitrary arguments, we need to make sure that all of the arguments passed in matches with the type defined at the parameter.

### Keyword arguments
For testing keyword arguments, we will switch the argument positions but ensure that the output of the function stays the same.

### Regular arguments
To ensure the basic functionality of method calls and function calls are still intact, we will write the exact program without the new calling conventions and make sure the outputs are correct.

## New AST forms:

To account for parameters with default arguments, we would need to include a new pattern for the `Parameter` type in `ast.ts`. The new pattern should include a field for the default value.
```
export type Parameter<A>  =
| { a?: A, tag: “reg”, name: string, type: Type }
| { a?: A, tag: “default”, name: string, type: Type, value: Value }
```

Additionally, we would need to include a field in both call and method call expressions to account for the inclusion of keyword arguments. The `kwargs` field should correspond to an array of arrays of argument names followed by their values.
```
export type Expr<A> =
| { a?: A, tag: "call", name: string, args: Array<Expr<A>>, kwargs: Array<[string, Expr<A>]> }
| { a?: A, tag: "method-call", obj: Expr<A>, method: string, args: Array<Expr<A>>, kwargs: Array<[string, Expr<A>]> }
```

## New functions, datatypes, and/or files:

In our global environment, we would need to add another map for functions which would keep track of the parameters names and its corresponding default values. We need to keep track of these fields in order to properly populate the arguments of function calls during compile time.

## Changes to existing functions, datatypes, and/or files:

When parsing function definitions, we need to keep track of the parameters with default values in the ast.

In `compiler.ts`, we will focus on modifying `codeGenExpr` in the switch cases including `call` and `method-call`. Generated arguments for functions calls will be different depending on the function signature. In the case that the arguments passed in is less than the number of parameters in the function signature, we have to populate those arguments with their default values.

## Value representation and memory layout for any new runtime values:

When we implement `kwargs`, it would require support from sets and dictionaries to loop through the arguments passed into the function calls. Defaults should not need any additional support, so the value representation and memory layouts would be similar.

## Milestone plan for March 4 – pick 2 of your 10 example programs:

Our initial plan is to get the cases relating to default arguments to work. This includes example programs 1, 2, and 5. We will start off with implementing program 1 and 2. Once we have default arguments working, we will move onto arbitrary arguments next (program 4, 8, and 9).
