# Destructuring

Relevant section(s) of python [specification/documentation](https://docs.python.org/3/reference/simple_stmts.html#assignment-statements).
The grammar is also copied below:

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


## Flow (copied from python documentation)

- If the target list is a single target with no trailing comma, optionally in parentheses, the
  object is assigned to that target.
- Else: The object must be an iterable with the same number of items as there are targets in the
  target list, and the items are assigned, from left to right, to the corresponding targets.
  - If the target list contains one target prefixed with an asterisk, called a "starred" target: The
    object must be an iterable with at least as many items as there are targets in the target list,
    minus one. The first items of the iterable are assigned, from left to right, to the targets
    before the starred target. The final items of the iterable are assigned to the targets after the
    starred target. A list of the remaining items in the iterable is then assigned to the starred
    target (the list can be empty).
  - Else: The object must be an iterable with the same number of items as there are targets in the
    target list, and the items are assigned, from left to right, to the corresponding targets.

## Valid syntaxes

```python
# 0) Don't break existing assignment
a: int = 9
a = a
a = 100
assert a == 100

# 1) Support destructuring tuples
a: int = 0
b: bool = False
t: (int, bool) = (1, True)
a, b = t
assert a == 1 and b == True

# 2) Generalization: Single element tuple
a: int = 0
a, = (1,)
assert a == 1

# 3) _ is throwaway
a: int = 0
a, _ = (1, 2)
assert a == 1

# 3.1) Consequentially, _ cannot be a valid variable name
x: int = 0
_ = 1
x = _
#   ^ SyntaxError: _ cannot be used as variable
# Discussion: `_` could still be a valid field name, such as x._

# 4) Splat operator
a: int = 0
b: [int] = None
c: int = 0
a, *b = (1, 2)
c, *_ = (1, 2)
assert a == 1 and b == [2] and c == 1

# 5) Empty splat operator
a: int = 0
b: int = 0
c: [int] = None
a, b, *c = (1, 2)
assert a == 1 and b == 2 and c == []

# 6) Single splat at any location
a: int = 0
c: [int] = None
b: int = 0
a, *c, b = (1, 2, 3)
assert a == 1 and c == [2] and b == 3

# 7) Splat always creates a list
b: [int] = None
c: [int] = None
_, *b = [1, 2, 3]
assert b == [2, 3]
_, *c = (1, 2, 3)
assert c == [2, 3]

# 8) Assignment happens in a left to right order. 
# Destructured assignment can happen at particular indicies in arrays.
x: [int] = [0, 1]
i: int = 0
i, x[i] = 1, 2         # i is updated, then x[i] is updated
assert i == 1 and x == [0, 2]

# 9) Assignment targets are performed entirely from left to right
# Part of our stretch goal: chained assignments
a: int = 0
b: int = 0
x: int = 0
a, b = x, a = 1, 2
assert a == 2 and b == 2 and x == 1

# 10) Optional parens around a target list
a: int = 0
b: int = 0
(a, b) = (1, 2)
assert a == 1 and b == 2

# 11) Starred assign happens in regular order
x: [int] = None
a: int = 0
a, *x, x = (1, 2, [3])
assert a == 1 and x == [3]

# 12) Object field assignment using destructured assignment
class Test(object):
  a: int = 0
  b: int = 0
t: Test = None
t = Test()
t.a, t.b = (5, 6)
assert t.a == 5 and t.b == 6
```

## Teams to collaborate with

- Lists: `head, *rest = [1, 2, 3]`
  - Both how memory is implemented and how values are assigned
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
  - (Stretch goal++) Parsing nested targets (e.g. `a, (b, c) = (1, (2, 3))`)
    - Note: we consider it unlikely we will get to this step
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
# We will use classes as stand-ins for tuples and arrays until such time as they are implemented
# For now, this "dirty hack" will rely on the positional offsets of properties
class OtherObject(object):
  q: int = 3
class Tuple(object):
  one: int = 10
  two: bool = True
  three: OtherObject = None
x: int = 0
y: bool = False
z: OtherObject = None
x, y, z = Tuple()
assert x == 10
assert y == True
assert z == None

# Program does not pass validation because of incompatible types
y, z, x = Tuple()
```

## Testing strategy

Our team will evenly distribute testing responsibilities among the team members. Tests will be written in accordance
with the Python specification provided above. Our tests will focus on covering common use cases and possibly problematic
edge cases.

## AST additions

We propose adding a couple new data structures to the AST to support destructured assignment. In particular, these
changes are made with the goal of unifying how assignment is treated in the AST. Rather than fully separate structures
for properties and variables, it makes sense to have them take on a common form.

```typescript
export type Stmt<A> =
  | {  a?: A, tag: "assign", target: Destructure<A>, value: Expr<A> }
  // Temporarily rename the old assign to id-assign until fully unified
  | {  a?: A, tag: "id-assign", name: string, value: Expr<A> }
  | ...

export interface AssignTarget<A> {
  target: Assignable<A>;
  // If this is the `_` ignore symbol
  ignore: boolean;
  // is this a starred target e.g. head, *tail = myList
  starred: boolean;
}

export interface Destructure<A> {
  // indicates if this is simple target assignment or destructuring
  isDestructured: boolean;
  targets: AssignTarget<A>[];
}

// Union of all assignable targets
export type Assignable<A> =
  | {  a?: A, tag: "id", name: string }
  | {  a?: A, tag: "lookup", obj: Expr<A>, field: string }

export type Expr<A> =
  | ...
  | Assignable<A>
  | ...
```

## Modifications to existing files

- `ast.ts`
  - Add `AssignTarget` type to represent the target of assignment (variable or object attribute) with relevant type and
    compiler decorations
  - Change `Assign` statement to contain an array of `AssignTarget`s rather than a name string
- `parser.ts`
  - Update the `AssignStatement` case in `traverseStmt` to support parsing destructured assignments
    - Additionally, integrating with attribute/object property assignment (unify assignment with other teams if
      possible)
  - Possibly create a new function `traverseAssignTargets` to parse any number of assign targets (this could be
    reused when parsing `for ... in ...`)
- `type-check.ts`
  - Add new function `tcDestructure` to encapsulate typechecking for destructured assignments
  - Possible add new function `tcAssignTargets` to encapsulate typechecking the correctness of assign targets (again,
    for the for loop iterators team)
  - Update the `assign` case in `tcStmt` to use `tcDestructure`
- `compiler.ts`
  - Add new function `codeGenDestructure` to generate WASM for destructuring
  - Update the `assign` case in `codeGenStmt` to use `codeGenDestructure`

## Memory layout changes

Our feature will not directly require any changes to memory layout. In general, we will be working on integrating with
other memory layouts and accessing their fields. Additionally, we will eventually be calling the List instantiate
methods, but that is not adding any new memory layout.

In WASM, we most likely _will_ need to add another local variable alongside `$$last` for all functions like
`$$assignValue`. This will be used for keeping track of what the current value is for assigning to all targets.

## What's NOT in scope

- Multiple assignment variable initialization
  - Our variable declarations rely on type annotations
  - Python only allows annotations on single target assignment
  - Therefore, we cannot support `x: int, b: bool = 4, False`
    - We can still support `x, b = 4, False` if `x` and `b` were already declared

## Additional Thoughts

The more I think about it, we probably want to make use of the other AST components as much as we can. For example:

```python
x: [int] = None
x = [0, 0]
a: int = 0
x[0], a = (1, 2)
```

would desugar to

```python
__destructureInternal = (1, 2)
x[0] = __destructureInternal[0]
a = __destructureInternal[1]
```

Most likely we'd need to do this in the
