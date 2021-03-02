# CSE231 Lists 
Erika Auyeung, Chao Chi Cheng

### 1. 10 representative example programs related to your feature. For each, a description of how  their behavior will be different/work/etc. when you are done.

#### Program 1
```python
class A(object):     
    a : int= 0
class B(object):    
    b : int= 0
x : [A] = None
y : [B] = None
z : [object] = None
x  = [A(), A()]
y  = [B(), B()]
z = x + y
```
#### Program 2
```python
items : [int] = None
items = [1, 2, 3]
```
#### Program 3
```python
items : [int] = None
items = [1, 2, 3] + [4, 5, 6]
```
#### Program 4
```python
items : [int] = None
n : int = 10
items = [1, 2]
n = items[0] + items[1]
```
#### Program 5
```python
items : [int] = None
items = [1, 2, 3] 
items[1] = 90
```
#### Program 6 &#8594; Runtime error (Index out of bounds, error code 3)
```python
items : [int] = None
items = [1, 2, 3, 4, 5, 6]
items[10] = 90
```
#### Program 7 &#8594; Runtime error (Operation on None, error code 4)
```python
items : [int] = None
items[0] = 11
```
#### Program 8 &#8594; Runtime error (Invalid argument, error code 1)
```python
items : [int] = None
items = [1, 2, 3]
print(items)
```
#### Program 9
```python
class A(object):     
    a:int= 0      
class B(A):    
    b:int= 0      
x : [A] = None
x  = [A(), B()]
```
#### Program 10
```python
items : [int] = None
items = [1, 2, 3]
print(items[2])
print(len(items))
```
#### Program 11 &#8594; Compile time error (type error)
```python
class A(object):     
    a:int= 0      
class B(A):    
    b:int= 0      
x : [A] = None
x  = [B(), B()]
```

### 2. A description of how you will add tests for your feature.
We will write tests like the cases we created above, and compare the results to the expected result.

If it is an error case, then we test if we catch the error inside the test file. A success will be if we catch the correct error with the appropriate error code.

The REPL will be tested on the web, where we will check if the program behaviors match to our expectation. Some example cases will be concatenation, field access, and assign.

### 3. A description of any new AST forms you plan to add.
```typescript=
type Type =
  | { tag: "list", content_type: Type }

type Stmt<A> =
  | {  a?: A, tag: "list_assign", list: Expr<A>, index: number, value: Expr<A> }

type Expr<A> =
  | {  a?: A, tag: "list_expr", contents: [Expr<A>] }
  | {  a?: A, tag: "list_lookup", list: Expr<A>, index: number }
```

Lists need to be identified as a unique type, which contains another type.
List element assignment is, like regular assignment or class member variable assignment, a `Stmt`.
Constructed lists (e.g. `[1,2,3]`) are `Expr`s.
List element lookup, like class member variable lookup, is an `Expr`.

### 4. A description of any new functions, datatypes, and/or files added to the codebase.
We do not have plans to add any of those to the codebase.

### 5. A description of any changes to existing functions, datatypes, and/or files in the codebase.

We will need to add lists and list lookup (e.g. `items[i]`) support for `traverseExpr`, `codeGenExpr`, and `tcExpr`.

For assignment to a list, we need to write a function to find least common ancestor type among all types of elements in a list. This is necessary for type-checking.

For assignment to an element in a list, we need to check if the expression type, or an ancestor of the expression type, is the type of the list for tcExpr. Add code to codeGenExpr to assign the element to the array. 

We need to add support for list concatentation. This means we will edit the `binop` situation for `expr`s. We will add code to `tcExpr` to find the least common ancestor type of two lists, which will be the type of the resulting list. We will also add code to `codeGenExpr` to generate the new combined list, which will most likely be done by creating a whole new list on the heap that contains the elements of the lists being concatenated.

We need to do runtime checks for `print(\<some list\>)`, certain operations on `None` (e.g. concatenation, `len()`, element access), and bound checking. Code needs to be added to `webstart.ts`'s `importObject`, `runner.ts`'s `wasmSource`, and to `codeGenExpr` to always call the bounds checking functions before doing assignment to a list element.

### 6. A description of the value representation and memory layout for any new runtime values you will add.

Our lists will be stored in this form on the heap.
```
Index:   Data:
0:       Type identifier (LIST)
1:       List length
2:       List capacity
3+:      [{expr i32}]
```
The first two indices are filled with metadata about the list: First is a type identifier that denotes the object here as a list, and second is the number of elements stored in this list. The third piece of metadata is the allocated storage for the list. (This is based on [C++'s vector capacity](https://www.cplusplus.com/reference/vector/vector/capacity/).) After the metadata are the elements of this list.

Like objects, lists are referred to using their base memory address (e.g. when assigning a list into a variable).

### 7. A milestone plan for March 4 – pick 2 of your 10 example programs that you commit to making work by March 4.

#### Program 2:
```python
items : [int] = None
items = [1, 2, 3]
```
#### Program 4:
```python
items : [int] = None
n : int = 10
items = [1, 2]
n = items[0] + items[1]
```

### 8. Advanced Features.
* Finding the Least Common Ancestor type, or "any type" lists like in Python
  * This allows us to run methods on certain elements of a list, e.g. given a list of `items = [1, <object>]`, we could run `items[1].method()` yet not `items[0].method`.
* List methods like `.append()`, `.clear()`, `.copy()`, `.count()`, and `.index()`