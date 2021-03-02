
## CSE 231: Project Milestone

### Progress
We have 2 of our example programs working now. Note that, due to a bug in how the `while` loop is implemented, we had to slightly modify one of our initial 2 test programs.
We've reported this issue here: https://github.com/ucsd-cse231-w21/chocopy-wasm-compiler/issues/43

Once this issue is resolved, our original first test program example should work fine.

### Representative example programs to make functional by March 11
As long as `list` is implemented, we are trying to make the following programs functional.

#### 1.
```
newList =[x for x in range(0,10) if x % 2 == 0]
newList
```

It creates a list of even numbers from the range 0 to 10.

#### 2.
```
newList =[x for x in range(0,10) if False]
newList
```

It creates a list of even numbers from the range 0 to 10.

#### 3.
```
newList =[x + 4 for x in range(0,10)]
newList
```

It creates a list of even numbers from the range 4 to 14.

#### 4.
```
newList =[x if x>0 else -x for x in range(-10,10)]
newList
```
It creates the list `[10,...,1,0,1,...,9]`.


#### 5.
```
newList =[print(x) for x in range(-10,10)]   # should print -10 to 9 after this line
newList
```
This example creates a list of only 20 `None` values, while printing all numbers from -10 to 9 (inclusive).

#### 6.
```
newList =[x for x in range(0,0)]
newList
```

This example should only create an empty list, because the comprehension’s iterable is empty.

#### 7.
```
newList = [x for x in [1, 2, 3, 4, 5]]
newList
```

This creates a new list with the same elements in the comprehension’s iterable: `[1, 2, 3, 4, 5]`.
Here, the comprehension’s iterable is a “literally-defined” list with literal values.

#### 8.
```
newList = [x for x in [1, 2, 3, 4, 5] if x % 2 == 0]
newList
```

This example creates a list consisting of only the even numbers from 1 to 5.
This comprehension works with a “literally-defined” list with literal values and a comprehension condition that only evaluates to `True` for some of the values.

### Biggest challenge we faced in implementation
The biggest challenge we faced was figuring out how to mock the implementation of a list while it is still not implemented.
To temporarily overcome this, we defined a built-in `Range` class and a built-in `range` function that our list comprehension implementation uses.
In the upcoming week of implementation, our main goal is to remove these built-in definitions and integrate our implementation directly with the official `list` implementation.
