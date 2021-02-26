# CSE231 Proposal

## Example Programs:

**Program 1:**

```
`1:fruits = ["apple", "banana", "cherry"]`
`2:for x in fruits:`
`3:    print(x)`
```

This is a program that represents the basic feature of iterator: iterating through a iterable.

**Program 2:**

```
1:for x in range(10):
2:    print(x)
```

Program 2 mainly focus on for loops with range() function, because it will return a new list with fixed elements starting from 0.

**Program 3:**

```
1:fruits = ["apple", "banana", "cherry"]
2:for x in fruits:
3:    print(x)
4:    break
```

Program 3 focuses on testing the break functionality.  Its output will be “apple”

**Program 4:**

```
1:fruits = ["apple", "banana", "cherry"]
2:for x in fruits:
3:    if x == "apple":
4:        continue
5:    print(x)
```

This is a program that representing **continue** feature. A continue statement should be able to skip to the next iteration.

**Program 5:**

```
1:fruits = ["apple", "banana", "cherry"]
2:for i, x in enumerate(fruits):
3:    print(i)
4:    print(x)
```

This program will test the support of enumerate() function with one parameter in list type. Using enumerate(), we could get the index and value of each element in a list.

**Program 6:**

```
1:adj = ["red", "big", "tasty"]
2:fruits = ["apple", "banana", "cherry"]

3:for x in adj:
4:    for y in fruits:
5:        print(x, y)
```

This program is a representation of nested iterator.

**Program 7:**

```
`1:numbers ``=`` ``[``0``,`` ``1``,`` ``2``]`
`2:for`` x ``in`` numbers``:`
`3:    ``pass`
```

Program 7 needs our compiler to offer support of pass statements in for loops’ body.

**Program 8:**

```
`1:for x in "banana":`
`2:    print(x)`
```

This program is mainly representing the ability of iterator that can iterating through characters in string.

**Program 9:**

```
1:def f():
2:    for i in range(10):
3:        if i == 5:
4:            return i
5:        else:
6:            print(i)
```

This program tests that the return keyword works normally in the for loop in a function call.

**Program 10:**

```
1:for x in [1, 2, 3]:
2:    print(x)
```

This program represents the scenario that iterator taking in a temporary iterable (only the elements of the iterable are accessible, the iterable object cannot be reached).

## Testing Plan:

We will add incremental test cases to test the program. That is, we will add separate test cases for parser, type-checking and compiler. We will also add the example programs above as comprehensive test cases that tests the overall performance of our code. Particularly, we will test the functionalities of related keywords, including **continue, break,** and **pass**.
Finally, we will test advanced or complicated programs, including nested for loops.

## AST Modifications:

1. Statements

a. **for** statement
`{`` ``a``?: ``A``,`` ``tag``: ``"for", name: Expr, index?: Expr, iterable: Expr, body: Array<Stmt<A>>`` ``}`
b. **continue** statement
`{`` ``a``?: ``A``,`` ``tag``: ``"continue" }`
c. **break** statement
`{`` ``a``?: ``A``,`` ``tag``: ``"break" }`

## New Functions and Datatypes:

We  need a new datatype for iterator, which will be very useful for iteration and foor loops within typechecking.

Modified functions:

1. `traverseStmt()`
2. `codeGenStmt()`
3. `tcStmt()`

Basically we need modify some files to offer support for For Loops, which should include parser.ts, type-check.ts, compiler.ts. However, currently there will be no new functions in our changes.

## Memory Layout:

No specific memory layout is needed to implement the iterator. But some indicators might be required such as index, and current element. Each iterator need at least 12 byte to initialize (4 byte for location of iterable, 4 byte for index, 4 byte for element).

## Mile Stone:

1. Full implementation of while loop
2. Full implementation of **continue, break,** and **pass**.
3. Start implementing Range() function 








