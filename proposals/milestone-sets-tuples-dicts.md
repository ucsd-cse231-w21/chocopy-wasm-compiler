# Project Milestone: Dictionaries

We have implemented initialization of dictionary and look-up feature in dictionary along with their respective typechecking. The test cases and code is written and a pull request has been raised.

## Target for March 11


By March 11, we aim to get all the examples mentioned in proposal working. We also added two additional examples which includes nested dictionaries. Overall, the examples we are targeting consist of following features:

- dictionary initialization using `dict` constructor
- built-in functions like `get`, `update`, `pop`, `clear`
- printing dictionary
- complex dictionaries and their respective operations. For example, nested dictionaries.

## Challenges faced in our week of implementation

We faced the following challenges during this week's implementation:
- For implementing dictionary, we had to implement hashtable and we wrote 100-150 lines of assembly code which was time-taking but it finally worked out!
- We had to keep track of our implementation with other teams: strings, lists, memory allocation and making sure it is compatible and modular enough so that it's easy to integrate.
- Implementing the typechecker part for dictionary assign and lookup with decorated AST, having not worked with it before in PA3.
- We assumed that the type-checking for nested dictionary will be taken care automatically by `===`. However, `===` does't work on objects with nested levels. That is even though 2 objects are same at different levels, it returns `False`. We used `JSON.stringify` to convert the object to a string before checking.

## Future Work

We implemented all the examples and dictionary functionalities mentioned in our proposal except `type` method, which is a generic method for all variables. We imagine ourselves implementing more functionalities of dictionaries mentioned in following three programs, if we had time:

1. Type method:
```python
d:[int, int] = None
d = {1:3, 5:9}
print(type(d))
```
The above code should return `dict`.

2. Dictionary constructor with an iterable as an argument.
```python
d:[int, int] = None
d = dict([(3, 2), (4, 1), (5, 3)])
```

3. Looping through dictionary using items.
```python
d:[int, int] = None
d = {1:3, 5:9}
for k, v in d.items():
  print(k, v)
```
The `items` should return a list of key-value pairs, which can be used to loop through dictionary.
