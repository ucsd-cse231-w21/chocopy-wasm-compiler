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

