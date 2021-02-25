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

- Parsing destructured assignments
  - Parsing multiple targets (e.g. `a, b = 1, 2`) for a destructured assignment statement
  - Parsing a hanging comma in a destructured assignment (e.g. `a, = (1,)`)
  - Parsing the "splat" operator (e.g. `a, *b = [1, 1, 2, 3, 5, 9]`)
  - (Stretch goal) Parsing chained assignments (e.g. `up, *rest = *rest, down = (0, 1, 2, 3)`)
- Typechecking destructured assignments
  - Typechecking individual tuple and array elements against a target
    (e.g. `a` in `a, b = (12, True)` or `b, a = [20, 40]`)
  - Typechecking multiple tuple elements or an array against a "splat" target
    (e.g. `b` in `a, *b, c = (True, 12, 13, None)` or `*b, c = [None]`)
  - Checking number of targets against number of elements when that is knowable at compile time (i.e. tuples)
  - Validating destructured assignments (i.e. not allowing multiple splat targets, etc.)
- Compiling destructured assignments
  - Support individual assignments from array and tuple elements
  - Support splat assignments from arrays and tuples
  - Add runtime checks when destructuring arrays whose lengths cannot be computed at compile time
  - Enforce proper assignment order (left to right)

## Two test cases to finish by March 4th

```python
# We will use classes as stand-ins for tuples and arrays
class Tuple(object):
  one: int = 0
  two: bool = False
  three: object = None
x: int = 0
y: bool = True
z: object = None
x, y, z = Tuple(10, True, None)
x == 10
y == True
z == None

# Program does not pass validation because of incompatible types
y, z, x = Tuple(10, True, None)
```

## Testing strategy
Our team will evenly distribute testing responsibilities among the team members. Tests will be written in accordance
with the Python specification provided above. Our tests will focus on covering common use cases and possibly
problematic edge cases.

## Modifications to existing files

- ast.ts
  - Add `AssignTarget` type to represent the target of assignment (variable or object attribute) with relevant type
    and compiler decorations
  - Change `Assign` statement to contain an array of `AssignTarget`s rather than a name string
- parser.ts
  - Update the `AssignStatement` case in `traverseStmt` to support parsing destructured assignments
  - Possible create a new function `traverseAssignTargets` to parse any number of assign targets (this could be
    reused when parsing `for ... in ...`)
- type-check.ts
  - Add new function `tcDestructure` to encapsulate typechecking for destructured assignments
  - Possible add new function `tcAssignTargets` to encapsulate typechecking the correctness of assign targets (again
    , for the for loop iterators team)
  - Update the `assign` case in `tcStmt` to use `tcDestructure`
- compiler.ts
  - Add new function `codeGenDestructure` to generate WASM for destructuring
  - Update the `assign` case in `codeGenStmt` to use `codeGenDestructure`

## What's NOT in scope

- Multiple assignment variable initialization
  - Our variable declarations rely on type annotations
  - Python only allows annotations on single target assignment
  - Therefore, we cannot support `x: int, b: bool = 4, False`
    - We can still support `x, b = 4, False` if `x` and `b` were already declared
