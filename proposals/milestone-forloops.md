# For Loops Milestone

## 2 programs working as expected
   
program 1: basic `for` loop with `range()` 
```python
i:int = 0
for i in range(5):
  print(i)
```

program 2: `for` loop with `break` in `if` condition 
```python
i:int = 0
for i in range(5):
  if i == 3:
    break
  else:
   print(i)
```

## Biggest challenge

Till now one of our biggest challenge is overloading and duplicate definition. In python3, users could call range() in multiple versions with either 1, 2 or 3 parameters, however in our compiler, we can only define one range() function, or there will be duplicate definition problems.


