# Destructuring

Relevant section of python specification/documentation: https://docs.python.org/3/reference/simple_stmts.html#assignment-statements

```
assignment_stmt ::=  (target_list "=")+ (starred_expression | yield_expression)
target_list     ::=  target ("," target)* [","]
target          ::=  identifier
                     | "(" [target_list] ")"
                     | "[" [target_list] "]"
                     | attributeref
                     | subscription
                     | slicing
                     | "*" target

starred_expression ::=  expression | (starred_item ",")* [starred_item]
starred_item       ::=  assignment_expression | "*" or_expr
attributeref ::=  primary "." identifier
```

Slicing: `a[1:3]`

```python
h, *tail = (True, 2, 3, 4)

# =>

_tmp = (1, 2, 3, 4)
h, *tail = _tmp
whole = _tmp

# =>

```


## Flow

- If the target list is a single target with no trailing comma, optionally in parentheses, the
  object is assigned tothat target.
- Else: The object must be an iterable with the same number of items as there are targets in the
  target list, and the items are assigned, from left to right, to the corresponding targets.
  - If the target list contains one target prefixed with an asterisk, called a “starred” target: The
    object must be an iterable with at least as many items as there are targets in the target list,
    minus one. The first items of the iterable are assigned, from left to right, to the targets
    before the starred target. The final items of the iterable are assigned to the targets after the
    starred target. A list of the remaining items in the iterable is then assigned to the starred
    target (the list can be empty).
  - Else: The object must be an iterable with the same number of items as there are targets in the
    target list, and the items are assigned, from left to right, to the corresponding targets.



## Valid syntaxes

```python
# Don't break existing assignment
a: int = 9
a = a
a = 100

# Support tuples
t: (int, int) = (1, 2)
a, b = t

# Generalization: Single element tuple
a, = (1,)
a == 1

# _ is throwaway
# Consequentially, _ cannot be a valid variable name
a, _ = t

# Splat operator
a, *_ = t

# Empty splat operator
a, b, *_ = t

# Single splat at any location
a, *_, b = t

# Splat realizes as a list
_, *b = [1, 2, 3]
b == [2, 3]
_, *c = (1, 2, 3)
c == [2, 3]

# Slicing assignment (Depends on tuple/list group)
# Stretch goal??
splat: [int] = [0, 0]
splat[:] = t
*splat[:] = t # illegal syntax

# Idiosyncracies of not quite instant assignment
# This **should** be the expected idea of how this implements
x = [0, 1]
i = 0
i, x[i] = 1, 2         # i is updated, then x[i] is updated
print(x)    # => [0, 2]

# Assignment targets are performed entirely from left to right
 a, b = x, a = 1, 2
 a == 2
 b == 2
 x == 1
```

## Teams to collaborate with

- Lists: `head, *rest = [1, 2, 3]`
- Tuples: `head, *rest = (1, 2, 3)`
  - Note: `a, b = b, a` actually creates a tuple `(b, a)`
- For loops/iterators: `for a, b in enumerate(dict): ...`
  - Technically enumerate returns a tuple and this is then destructured

## Technical aspects to implement

## What's NOT in scope

- Multiple assignment variable initialization
  - Our variable declarations rely on type annotations
  - Python only allows annotations on single target assignment
  - Therefore, we cannot support `x: int, b: bool = 4, False`
    - We can still support `x, b = 4, False` if `x` and `b` were already declared
