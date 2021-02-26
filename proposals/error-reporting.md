## 10 representative example programs related to your feature. For each, a description of how their behavior will be different/work/etc. when you are done.

(1) **AttributeError**
```Python
Class Foo(object) {
	def func():
		print(4)
}
f: Foo = none
f = Foo()
f.a
```

Behavior: compiler will throw an AttributeError at line “f.a”



(2) **IndentationError**
```Python
while True:
       print(2)
	print(3)
```
The output is: IndentationError: unexpected indent



(3) **Recursion Error**
```Python
def fun():
	fun()
fun()
```
The output is: Runtime Error: maximum recursion depth exceeded



(4) **Name Error**
```Python
print(a * 3)
```
The output is: line 1: NameError: “a” is not defined.



(5) **ZeroDivisionError**
```Python
4/0
```
Behavior: compiler will throw a ZeroDivisionError.



(6) TypeError
```Python
print(“2” + 2)
```
Behavior: compiler will throw a TypeError



(7) **IndexError**
```Python
class Vector(object):
    # Attributes
    items: [int] = None
    size: int = 0

    # Constructor
    def __init__(self:"Vector"):
        self.items = [0]

vec:Vector = None
vec = Vector()
vec[3]
```
Behavior: compiler will throw IndexError at “vec[3]”



(8) **TypeError**
```Python
a = [“apple”,“banana”,“orange”]
print(a[“string”])
```
Behavior: compiler will throw TypeError at line 2



(9) **MemoryError**
The memory size is 1
```Python
x : int = 1
y : int = 1 
```
Behavior: compiler will throw Memory Error in runtime. 



(10) **KeyError**
```Python
ages: dict = {'Jim': 30, 'Pam': 28, 'Kevin': 33}
ages[‘Michael’]

Behavior: compiler will throw a KeyError
```


## A description of how you will add tests for your feature. We will use unit tests for our different exceptions. For example, we can add the assertion function
```javascript
export function assertFail(name: string, source: string, expectedErr: Error) {
  it(name, async () => {
    try {
      const repl = new BasicREPL(importObject);
      const result = await repl.run(source);
      fail("Expected an exception, got a type " + JSON.stringify(result));
    } catch (err) {
      expect(err).to.be.an(expectedErr);
    }
  });
}
```
Therefore, we can test whether the source throws an error and what type of error it is.


## A description of any new AST forms you plan to add.
We will add a new type location in the AST. For all the AST types we defined, they will contain the location type to represent the location of the corresponding python code. 
For example:
```Python
a: int = 1
```
The corresponding Stmt is : {a:? A, tag:”assign”, name : a, value:{a:?A, tag:”literal” , value:{tag:”num”, value: 1, location:{line:1,col:7,length:1}} , location:{line:1,col:7,length:1}},location:{line:1,col:1,length:7}}



## A description of any new functions, datatypes, and/or files added to the codebase.
Functions: None


DataTypes: type Location describing the location of where the error occurred.
`export type Location = { line : number, col : number, length : number }`


Files: error.ts will include all the exception types including the pre-defined errors. 
- `KeyboardInterupt`: Raised when the user hits the interrupt key
- `Exception`: The base class of all the following exceptions. 
- `StopIteration`: Raised by function `next()` and iterator’s `__next()__` if there is no further items produced. 
- `ArithmeticError`: The base class of all exceptions related to arithmetic error. 
- `OverflowError`: Raised when the result of an arithmetic operation is too large to be represented.
- `ZeroDivisionError`: Raised when the second argument of a division or modulo operation is zero.
- `AttributeError`: Raised when an attribute reference or assignment fails.
- `LookupError`: Raised when a given process doesn’t exist.
- `IndexError`: Raised when a sequence subscript is out of range.
- `KeyError`: Raised when a mapping (dictionary) key is not found in the set of existing keys.
- `MemoryError`: Raised when an operation runs out of memory.
- `NameError`: Raised when a local or global name is not found.
- `UnboundLocalError`: Raised when a reference is made to a local variable in a function or method, but no value has been bound to that variable.
- `RuntimeError`: The base class of all exceptions related to runtime error. 
- `RecursionError`: It is raised when the interpreter detects that the maximum recursion depth is exceeded. 
- `SyntaxError`: Raised when the parser encounters a syntax error.
- `IndentationError`: Raised when the program has incorrect indentation. 
- `TypeError`: Raised when an operation or function is applied to an object of inappropriate type.
- `ValueError`: Raised when an operation or function receives an argument that has the right type but an inappropriate value
- `UnicodeError`: Raised when a Unicode-related encoding or decoding error occurs.

Errors are not limited to pre-defined errors. We will maintain the list of errors while other teams may require. 


## A description of any changes to existing functions, datatypes, and/or files in the codebase.
We haven’t deleted the class TypeCheckError in type-check.ts. But we already imported our error.ts in this file.


## A description of the value representation and memory layout for any new runtime values you will add.
N/A.


## A milestone plan for March 4 – pick 2 of your 10 example programs that you commit to making work by March 4.
We have finished basic error classes in error.ts for our proposal, so that other groups can use those classes to throw relevant errors. We will add more details into each subclass. For example, NameError should take “name” as one of the parameters in the constructor. 
Also, by March 4, we will finish testing each of the errors. And add more error classes/ modify error classes as per other group’s requests. 
