## Code and tests demonstrating that the 2 programs you chose from your proposal are working as expected

### Code for the programs 1 and 2 from our original proposal
```
 assertPrint("project-proposal program 1", `
  def add_default_10(x : int, y : int = 10) -> int:
	  return x + y

  print(add_default_10(20))
  print(add_default_10(20, 5))`, ['30', '25']);

  assertPrint("project-proposal program 2", `
  def add_defaults(x : int = 10, y : int = 20, z : int = 30) -> int:
	  return x + y + z

  print(add_defaults())
  print(add_defaults(40))`, ['60', '90']);
```
These programs differ slightly from the ones in our original proposal because verify correctness using print statements here. Again, program 1 tests for a single default parameter, and program 2 tests for multiple (i.e. all) default parameters.

### Test results for programs 1 and 2 + others

Below are the results of running `npm test` on our test programs (including programs 1 and 2 from above.)

```
  defaults
    √ params default
    √ params default
    √ params default more params (43ms)
    √ project-proposal program 1 (45ms)
    √ project-proposal program 2
    √ params default more params
    √ function-with-multiple-default-params (42ms)
    √ function-with-incorrect-default-param
```

## A description of which examples will work by March 11

We intend on having examples 3, 5, 7 working by March 11 because they do not depend on the completion of features by other teams.

Additionally, if loop iterators are functional, we may be able to complete examples 4 and 9, and if sets/dictionaries are functional, we might be able to complete example 6.

### Example 3
1. The parser must be able to handle keywords and enforce that keyword arguments occur in the rightmost argument positions.
2. The typechecker needs to assign expressions to the keywords in the correct positions.
3. The AST will need an optional field for keywords in function and method calls.
Again, program 3 looks like:
```
def subtraction(a : int, b : int) -> int:
	return a - b
subtraction(a = 10, b = 5) // returns 5
subtraction(b = 10, a = 5) // returns -5
```

### Example 5
After discussing with the closure team, we decided to modify program 5 from our original proposal such that constructors may only be called on an assignment. We only allow initializations to hold literals, and assignment of default values are treated as initializations. Thus, program 5 after modification should look like
```
class Foo(object):
	bar : int = 7
	def set(self: Foo, bar: int) -> None:
		self.bar = bar
def baz(x : int, foo : Foo = None) -> int:
	if foo == None:
		return x
	else:
		return foo.bar + x

foo : Foo = None
foo = Foo()

print(baz(5)) // should print 5
print(baz(5, foo)) // should print 12
```
### Example 7
After further review, we believe that implementing this example will be similar to how we implemented defaults in function parameters. We noticed that class methods are typechecked in the function tcDef, which is used to typecheck functions. Using similar logic, we should be able to populate missing arguments that have corresponding parameters with default values.

Program 7 from our original project proposal looks like:
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

## A description of the biggest challenge you faced in your week of implementation

The biggest challenge we faced was trying to use the type environment during code generation in `compiler.ts`. We initially attempted to pass around the type environment produced from `type-check.ts`, but this proved inefficient and not good for modularity, so we decided to implement the logic for adding the literals for missing arguments corresponding to parameters with default values within the typechecker.


#

# Update on milestone proposal

## Overview of what we did this week
This week, on top of implementing default values for functions last week, we were able to implement support for default values within methods of a class using similar logic this week. After adding support for default values within class methods, we mainly focused on implementing keyword arguments.

### AST
We added a field (non-optional) for keyword arguments in both `method-call` and `call-expr` consisting of an array of arrays of `[string, Expr<A>]`. After careful consideration, we opted to choose an array over a map. We wanted to keep the AST as simple as possible without introducing new data structures. We believe that this decision may make future parsing tests easier to write.

### Parsing
We refactored the code for parsing to be less “hacky” by lifting functionality from `traverseParameters` into helper functions. Specifically, we added a helper function for traversing type definitions as well as helper function for traversing default values.

For keyword arguments, we modified the parsing code for traversing arguments in function and method calls. Again avoiding “hackiness”, our implementation closely mimics the syntax and semantics of native Python. Specifically, we disallow the repetition of the same keyword argument and enforce that all keyword arguments must follow positional arguments. We lifted some code from the original implementation of `traverseArguments` into `traverseArgument`, and added support for keyword arguments by creating an additional helper method called `traverseArgumentValue`. To determine whether an argument is a keyword argument, `traverseArgumentValue` checks whether the supplied argument to a function or method call includes an assignment operator followed by a valid expression.

### Type-check
Finding the similarities in the way we generate default arguments for method calls and function calls, we moved the logic to a new function called `populateDefaultParams`. This method handles the logic of adding new default arguments to the argument fields of the respective method call or function call.

From the kwargs generated by the parser, each element in this array needs to be type-checked as there is an expression associated with each keyword pair. From the array of keywords, we generate a map and use it to put the arguments in the correct order by looking at the name of the parameter in the function definition.

### Codegen
A common technique that was used for all implemented (and unimplemented) features is that during type-check, we read the function definition and rearrange the arguments for the calling expression. The advantage of this desugaring technique allows us to make no changes in codegen. However, for more complex cases in which closures are involved, this technique may not always work.

## Overview of our progress

### Examples were we able to get to
1. Default
2. All defaults
3. Keyword argument
5. Default construct (modified as stated in last pull request)
7. Default inside class method

### Examples we were not able to get to
4. Arbitrary argument
5. Default is a construct (original)
6. Keyword arguments passed as dictionary
8. Arbitrary arguments inside class method
9. Default and arbitrary arguments
10. Arbitrary arguments and keyword arguments passed as a dictionary

## 3 example programs that requires us to extend our design

### 1) Defaults as function calls
```
def func1(x : int) -> int:
  print(x)
  return x

def funcDefault(y : int = func1(3)) -> int:
  return y

funcDefault() // should return 3
```

In the early stages of the project, for simplicity’s sake (and to be closer to ChocoPy), we decided to restrict default arguments to literals in response to this comment from the closure team:
“As a member of the closures (as well as first-class functions and lambda expression) group, I would say that it seems very difficult to know the number of arguments of a callable at compile time when involving default arguments and first-class functions.”

In Python, however, default argument values can be any expression.

During lecture, it was suggested that we could use a special placeholder value to represent unsupplied arguments (in which a default argument must be supplied). Then, in the body of the function, we would check whether an argument is equal to the special placeholder value, and replace it with the corresponding default value if so. If we had more time, we would work more closely with the closures team to support lambda expressions as default arguments following Joe’s approach.

### 2) Arbitrary arguments to iterate over
```
def sum(* nums : int):
  temp : int = 0
  for num in nums:
    temp = temp + num
  return temp

sum(1, 2, 3) // should return 6
```

Our idea for extending our implementation to include arbitrary arguments is to replace the arbitrary arguments in a function or method call with a generated list object in `type-check`. The bulk of the work would be in `type-check`, where we would generate the list from the arbitrary arguments.
We would need to make sure that the list consists of elements of all the same type, which the list team should already be enforcing in their implementation. Finally, to get this program to run, we would require additional support from both the list team and the iterator team to loop and access each element of the list.

### 3) Default constructor initialization
```
class Foo(object):
	bar : int = 7
	def set(self: Foo, bar: int) -> None:
		self.bar = bar
def baz(x : int, foo : Foo = Foo()) -> int:
	return foo.bar + x

baz(3) // should return 10
```

This program would create a new object of class `Foo` when the function `baz` is called without a second argument. The idea is that the default value for the second parameter would be a pointer to the newly created object.

While we were in the middle of implementing this program and spent a lot of time discussing possible approaches, we were not able to fully implement this feature. Below, we will go into detail on how we intended to implement this feature.

## Changes to files

### AST
```
export type Defaults =
  | Literal
  | { tag: "uninit_param", classname: string }
```
We wanted to add this new type to the AST for default parameters so that we can explicitly handle constructs as values for default parameters.

### Parser
In the parser, we would distinguish whether a default value is a construct or a literal based on whether Lezer returns a call expression. If a call expression is returned, we would generate an `uninit_param` for the construct, and otherwise generate a `Literal`. Although a construct is a call expression, and not a literal, we explicitly allow constructs to be default values.

### Type-checker
In the type checker, before adding a default value for the corresponding default parameter, we would need to check if the default value is a `uninit_param`. When the `uninit` tag is encountered, we would transform the default value to a `construct` of the class name and add it to the arguments.

### Compiler
For function and method calls in code generation, we would not need to do any additional work because the compiler already generates code for all the desugared arguments using `codeGen`. The `construct` that we insert during `type-check` works to our advantage, and a new object will be created at run time while the address to the object is placed on the stack for the function or method call.

## Discussions, trade offs

We went back and forth on deciding whether the logic for creating `construct` should be in `compiler.ts` or in `type-check.ts`. Joe left the following comment suggesting that we should implement this logic in `compiler.ts`.

> This would make the type-checker no longer add extra arguments drawn from the defaults, but always add an appropriate number of extra arguments with a default “uninitialized” value.

However, after further consideration, we believe that implementing this logic in `type-check.ts` would be similar to what we have already implemented for generating and populating default values. The additional benefit would be that we would not have to worry about altering arguments in `codeGen`.
