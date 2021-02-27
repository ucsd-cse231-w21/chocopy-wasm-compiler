
## CSE 231: Project Proposal

### 10 representative example programs related to your feature. For each, a description of how their behavior will be different/work/etc. when you are done.
#### 1.
```
newList = [x for x in range(0,10)]
newList
```

It creates a list equivalent to `range(0,10)`.

#### 2.
```
newList =[x for x in range(0,10) if x % 2 == 0]
newList
```

It creates a list of even numbers from the range 0 to 10.

#### 3.
```
newList =[x for x in range(0,10) if False]
newList
```

It creates a list of even numbers from the range 0 to 10.

#### 4.
```
newList =[x + 4 for x in range(0,10)]
newList
```

It creates a list of even numbers from the range 4 to 14.

#### 5.
```
newList =[x if x>0 else -x for x in range(-10,10)]
newList
```
It creates the list `[10,...,1,0,1,...,9]`.


#### 6.
```
newList =[print(x) for x in range(-10,10)]   # should print -10 to 9 after this line
newList
```
This example creates a list of only 20 `None` values, while printing all numbers from -10 to 9 (inclusive).

#### 7.
```
newList =[x for x in range(0,0)]
newList
```

This example should only create an empty list, because the comprehension’s iterable is empty.

#### 8.
```
newDict = {a:True for a in [1, 2, 3, 4]}
newDict
```
This is an example of dictionary comprehension, which creates a dictionary that consists of all keys in [1, 2, 3, 4] with True as their corresponding values.


#### 9.
```
newList = [x for x in [1, 2, 3, 4, 5]]
newList
```

This creates a new list with the same elements in the comprehension’s iterable: `[1, 2, 3, 4, 5]`. 
Here, the comprehension’s iterable is a “literally-defined” list with literal values.

#### 10.
```
newList = [x for x in [1, 2, 3, 4, 5] if x % 2 == 0]
newList
```

This example creates a list consisting of only the even numbers from 1 to 5. 
This comprehension works with a “literally-defined” list with literal values and a comprehension condition that only evaluates to `True` for some of the values.

### A description of how you will add tests for your feature.
- We should have a test that ensures that elements are only added to the list if the comprehension condition evaluates to `True`
- We need to have type-checking tests to ensure that the comprehension body evaluates to an expression, the comprehension’s iterable type-checks for a proper iterable, and the comprehension condition type-checks to a boolean condition
- We need to have runtime tests that ensure that the lists created from comprehension only have the correct, expected values, across different ways of specifying the comprehension’s expression, iterable, and condition.

### A description of any new AST forms you plan to add.
We add the following expression to our AST:
```
{ a?: A, tag: ‘comprehension’, expr: Expr<A>, field: string, iter: Expr<A>, cond?: Expr<A> }
```
This will correspond to `[expr for field in iter (if cond)?]`

For block expressions (see below), we plan to add:
```
{ a?: A, tag: ‘block’, block: Stmt<A>[], expr: Expr<A> }
```

### A description of any new functions, datatypes, and/or files added to the codebase.

One easy way to implement comprehension is to transform list comprehension into a for loop:

```
[expr for field in iter (if cond)]
```

can be transformed into

```
list = []
for field in iter:
  if cond: # optional
    list.append(expr)
list
```

Before the iterator team implements the for loop, we could use a while loop instead. 
Since Python iterators don’t have a `has_next()` method and will raise a `StopIteration` error after the iterator ends, we will make an assumption here that there is an internal `has_next()` method defined for iterators:

```
list = []
while has_next(iter):
  next = next(iter)
  if cond: # optional
    list.append(next)
lists
```

These will be compiled to a “block expression” as mentioned in lecture. 
This “block” statement is internal to the compiler, and when it is compiled, all the statements will be compiled, followed by the compiled expression.

After type checking, we can add a new pipeline called “transformation”, that would transform syntactic sugars (like list comprehensions) into more code/AST. 
We plan to add a new file called transform.ts that will do this transformation on the type checked AST. The transform function would look like the following:

```
function transform(expr: Expr<A>): Expr<A> {
	switch (expr.tag) {
		case ‘comprehension’:
			transformed = {a: expr.a, tag: ‘block’}
			// Add a statement for initializing the list variable to the block
			// Add statement(s) for the for loop (which appends to this list variable) to the block
			// Store the list id in the transformed's expr field
			return transformed
	}
}
```

### A description of any changes to existing functions, datatypes, and/or files in the codebase.
- In the parsing function for expressions, add a new “switch” case to parse list comprehensions. 
  This case will take care of parsing the comprehension’s per-element expression (“expr”), iterable (“for field in iter”), and comprehension condition (optional).
- In the type checking function for expressions, we would add a new “switch” case to type-check the comprehension, iterable, and comprehension condition (if provided).
- For the compiling function for expressions, we would add a new “switch” case that takes care of generating wasm code that: initializes a new list, goes through the iterator and adds elements to the list only if the iterable condition (which defaults to `True` if not provided) is satisfied.


### A description of the value representation and memory layout for any new runtime values you will add.
This comprehension feature would not add any new runtime values, but will rely on the `List` type. 
Essentially, this comprehension produces a new list value in memory whose elements are constructed from the comprehension structure.


### A milestone plan for March 4 – pick 2 of your 10 example programs that you commit to making work by March 4.
We can commit to making Example #1 and #3 work by March 4. 
These examples basically cover the simplest usages of list comprehension using the range iterable and an optional comprehension condition. 
If we finish list comprehension early, we might expand to other forms of comprehension, like dictionary comprehension, later on.
