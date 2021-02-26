# Local Type Inference (maybe Generics)

## Representative Programs


### Program 1 (number)
x = (1 + 3) * 2

User does not need to declare the type of x and the right hand side can be an expression. Should be able to infer that x is a number and complete the assignment. 

### Program 2 (bool)
y = (10-5) < (2 * 3)

The user no longer needs to declare the type of y before it is assigned here, and instead the type is inferred from the expression on the right hand side to be a boolean. 

### Program 3 (None)
z = print(1)

Since the return type of print is None, the type of z is inferred to be None. 

### Program 4 
x = (1 + 3) * 2
y = x * 2
z = x + y 

From the types of x and y we are able to infer the type of z from the right hand side. 

### Program 5
class List(object):
  def sum(self : List) -> int:
	return 1 // 0 # Intentional error! Make sure we implement in subclasses
 
class Empty(List):
  def sum(self : List) -> int:
	return 0

class Link(List):
  val : int = 0
  next : List = None
  def sum(self : Link) -> int:
	return self.val + self.next.sum()
  def new(self : Link, val : int, next : List) -> Link:
	self.val = val
	self.next = next
	return self
    
l: List = Link().new(5, Link().new(1, Empty())) 
print(l.sum())
print(l)

We expect for l to be type List since the user explicitly annotated it. If that annotation were missing then the type of l would be inferred as Link. 

### Program 6
def g(z: int): 
  def f(y): 
    return y + 1
  x = f(1)

From the type of the argument of f we can infer the return type of f, from which we can infer the type of x

### Program 7
def g(z: int): 
   z = z + 1 
   return z

Here since the type of z is known we can infer the return type of g from its body. 

### Program 8

T = TypeVar('T')      

def first(l: Sequence[T]) -> T:
    return l[0]

Users can define type variables for generic syntax. 

### Program 9 

class A:
   x: int = 5
   y: int = 3

class B:
  x: str = ‘5’
  y: str = ‘3’

def f(obj): 
  return obj.x + obj.y  #this needs some kind of defined behavior

We’re still considering how to handle programs that like this in a way that is compatible with REPL. Options that we have thought about so far
Error message indicating that type annotations are needed. 
Determine types based on call sites in code (will break in REPL). 

### Program 10

# Before: 
T = TypeVar('T')
def f(x: T) -> T: ...
	
# Later in REPL: 
f(1)                   
f('a')   

Infer the type of the function based on the types of the arguments passed at REPL so the above should be valid for sensible implementations of f. 
Testing
Our testing strategy will be driven by unit tests at the following levels*:
Check that a set of reasonable expressions types are inferred correctly 
e.g. 1, True, None, constructor calls, and variable usages   
Check AST forms produced after type inference and type checking
Ensure the inferred types are correct
Ensure that users can declare variable as a super type to override the type that would have been inferred successfully
Ensure generic types exist and their usage is valid 
Check that programs that use type inference produce correct outputs
Check that reasonable errors are produced when more type information is required 
*We may also consider exploring property-based testing if time permits. 
Ast Forms
For Local Type Inference: No changes should be needed
For Generics: we will need to add parsing support for type signatures that represent ‘generics’. E.g., ‘Generic[T]’ and ‘Sequence[T]’ where T is declared as ‘T = TypeVar(..)`. This means that the ‘Type’ data structure in ast.ts will have be modified to accommodate these generic types. Another design choice is to create separate ‘FuncDef’ data structures in the AST that encode a generic function declaration.
Probably the best option is to modify the ‘Type’ data structure to accommodate ‘generic types’ like ‘T = TypeVar(..)’ and ‘Generic[T]’, and then pattern match on those types during code generation.

Functions, data types, and files
Type Inference
We suspect no additional files will be needed to support type inference.
We'll modify the parsing to make a type definition optional in variable assignment, and instead call a new function inferType to infer the variable's type
If inferType fails so will compilation with a error indicating more type information is needed
Generics
We also suspect no new files will be necessary to implement Generics.
We'll introduce support for the TypeVar syntax allowing users to declare a generic type
This will require introduction of a new data type to unbounded parametric polymorphism
We'll also need to modify existing type checking functionality to type-check calls to functions defined with generics with arguments of known types
In short to support type inference and generics, we'll introduce the following new functions and data types will be required (along with code changes to existing parsing and type checking features):
inferType(e: Expr): Type - returns the type of the expression e
a datatype to represent Python's TypeVar object

	 	 	 	
A description of any changes to existing functions, data types, and/or files in the codebase.
Many parts of the type inference has already been done. Once we remove many of the `NotAVariable` errors that are deliberately thrown we should be mostly done with the first five programs. For programs 6-8, `checkReturnType` will require some minor modifications to perform inference, and we will also need to modify `inferExprType` to propagate type information inside function calls.

Memory Layout
To accommodate user defined types variables, generic functions will likely need to accept not values but references to the values. For values like ints and bools, this requires instantiating dummy objects that have one field, and for objects, I don’t foresee necessary modifications to our current implementation for generic functions that do not access object fields. For generic functions that will access object fields, this is currently still under consideration.

Milestones
By March 4th, we commit to commit to the following:
making local-type inference work for variable declarations (Programs 1 & 2) 
Making rudimentary subtyping/inheritance work (Program 5)




References 
https://www.python.org/dev/peps/pep-0484/
