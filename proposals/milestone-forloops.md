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
  if i == 3:
    break
    print(i)
  else:
    print(i)
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
for i in range(0, 6, 2):
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
i:int = 0
def f():
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


