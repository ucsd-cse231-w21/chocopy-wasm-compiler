# For Loops Milestone

## 2 programs working as expected
   
program 1: basic `for` loop with `range()` 
```python
i:int = 0
for i in range(5):
  print(i)
```

program 2: `for` loop with `break` in `if` condition 

Note that this program is slightly different with the one in our original proposal. 

This is because we found that we cannot support lists without a proper list implementation.

We've decided to only support `for` loops with `range()` and adjust our programs accordingly.
```python
i:int = 0
for i in range(5):
  print(i)
  if i == 3:
    break
  else:
    pass
```

## test cases for newly added features:

1. iterate for 0 loops
```typescript
  assert(
    "for range(0)",
    `
    i:int = 0
    for i in range(5):
        print(i)
    i
    `,
    pyInt(-1)
  );
```

2. iterate for 10 loops

```typescript
  assert(
    "for range(10)",
    `
    i:int = -1
    for i in range(10):
        print(i)
    i
    `,
    pyInt(9)
  );
```

3. break outside for-loop

```typescript
  assertTCFail(
    "break outside loop",
    `
    i:int = 0
    break
    for i in range(5):
        print(i)
    `,
    pyInt(9)
  );
```

4. break
```typescript
  assert(
    "break at 5",
    `
    i:int = -1
    for i in range(10):
        print(i)
        if i == 5:
            break
        else:
            pass
    i
    `,
    pyInt(5)
  );
```

## Updates to the examples we plan for March 11
program 1 (complete):
```python
i:int = 0
for i in range(5):
  print(i)
```

program 2 (complete):
```python
i:int = 0
for i in range(5):
  if i == 3:
    break
    print(i)
  else:
    print(i)
```


program 3:
```python
i:int = 0
for i in range(0, 7, 2):
  print(i)
```

program 4:
```python
i:int = 0
for i in range(5):
  if x == 3:
    continue
  print(i)
```

program 5:
```python
x:int = 0
idx:int = 0
for idx, x in enumerate(5):
  print(idx)
  print(x)
```

program 6:
```python
i:int = 0
j:int = 0
k:int = 0
for i in range(5):
    print(i)
for j in range(6):
    print(j)
for j in range(7):
    print(k)
```

program 7:
```python
i:int = 0
for i in range(5):
  pass
```

program 8:
```python
class a(object):
  curr:int = 0
  def f(self:a):
    i:int = 0
    for i in range(3):
      self.curr = self.curr + 1

r:a = None
r = a()
print(r.curr)
r.f()
print(r.curr)
```

program 9:
```python
def f():
  i:int = 0
  for i in range(5):
    if i == 3:
      return i
      print(i)
    else:
      print(i)
```

program 10:
```python
i:int = 0
j:int = 0
for i in range(5):
  for j in range(5):
    print(i, j)
```
## Biggest challenge

Till now one of our biggest challenge is overloading and duplicate definition. In python3, users could call range() in multiple versions with either 1, 2 or 3 parameters, however in our compiler, we can only define one range() function, or there will be duplicate definition problems.

The second challenge is the break statement. When there are recursive blocks exists inside a for-loop, the wasm br instruction needs a $depth
parameter to determine which block to break through. Therefore, we have to add a depth recorder inside the type check environment to record
the current depth and give the value to all break statements.

Another challenge is incorporating the for loop into class methods. Since we are implementing the range() function as an object, we need to handle the class variables, and the heap index correctly

## Final Submission

There are three example programs or scenarios that would require extensions to our design that we can imagine making, but didn't have the time for. 

#### Program1

``` python
i:int = 1
j:int = 2
list : [int] = None
list = [5,8,10]
for i in list:
  print(i)
```

We didn't handle the case where iterable is an id variable, and actually it needs more information than a range object or list-expr, because we may need to find some metadata such as length of a list. Which might need us to check it using wasm rather than typescript. This may consume a lot more time. so we haven't realized this feature yet. 

#### Program2

``` python
i : str = ""
for i in "Compiler":
  print(i)
```
String are actually structured very similar to lists. They are lists of chars. Since our program supports
iterating through lists. So, iterating through a string should be easily achievable.
#### Program 3

``` python
a:int = 0
b:int = 0
c:int = 0
for a, b, c in [[1,2,3], [4,5,6]]:
  print(a)
  print(b)
  print(c)
```
Currently the `Destructure` requires value to be type `class` if we have multiple `target`. 
For this class, it must have as many member variables as the number of target in the destruvture. To assign destructure we have to create some specific classes for different numbers of target, we may not have enought time to do this feature.
