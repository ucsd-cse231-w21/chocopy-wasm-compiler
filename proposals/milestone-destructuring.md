## Working Code

We have added several unit tests to `destructure.test.ts` to test our new features. The following two closely match the
test cases we specified in the original `destructuring.md` proposal. We have additionally implemented extra unit tests
beyond those listed below to check smaller segments of our implementation (parsing specific logic for example).

### Unit Test 1

```python
# march-4-test-case-1
class OtherObject(object):
  q: int = 3
class Tuple(object):
  one: int = 10
  two: bool = True
  three: OtherObject = None

x: int = 0
y: bool = False
z: OtherObject = None
t: Tuple = None

t = Tuple()
t.three = OtherObject()
x, y, z = t

# Assertions
x == 10
y == True
z is t.three
```

This test demonstrates several of the new features we've added:

- Parsing multiple assignment targets (i.e. `x, y, z = t`)
- Type checking multiple assignment targets against a destructured object (i.e. we check whether we can assign `t.one`
  to `x`, `t.two` to `y`, etc.)
- Compiling the ast to working WASM that successfully destructures objects (i.e. we actually store the value of `t.one`
  in `x`, `t.two` in `y`, and `t.three` in `z`)

Additionally, it's clear that our new features have not affected our ability to parse, type check, and compile
existing assignments. The unit tests for invalid assignments still fail (as expected).

### Unit Test 2

```python
# march-4-test-case-2
class OtherObject(object):
  q: int = 3
class Tuple(object):
  one: int = 10
  two: bool = True
  three: OtherObject = None

x: int = 0
y: bool = False
z: OtherObject = None

y, z, x = Tuple()
```

This test throws an error while type checking, demonstrating that the type checking logic catches an invalid destructure
assignment where one of the destructured values is not assignable to its target variable.

We have additional tests checking the following edge cases:

- Destructuring to object attributes (e.g. `x.one, x.two = t`)
- Destructuring an object containing a single attribute (e.g. `x, = Tuple()` where `Tuple` only has a single
  attribute `one`)
- Throwing an error when the number of targets does not match the number of destructured values (e.g. if `Tuple`
  contains two values, both `x, = Tuple()` and `x, y, z = Tuple()` throw type check error)

### File Changes

We have made changes to the following files:

- `ast.ts`
- `parser.ts`
- `type-check.ts`
- `compiler.ts`

## Expected Progress by March 11

### Lists

Since the list team appears to be making good progress with their features, we should be able to add support for list
destructuring by March 11.

```python
a, b, c = [1, 2, 3]
a == 1
b == 2
c == 3
```

### Tuples

The tuple team is focusing on adding support for dictionaries, so as far as we're aware, they have not started
working on tuples. Even if they begin incorporating tuples next week, it's unlikely they'll finish tuples
early enough for us to add destructuring support.

### Starred "Splat" Operator

Starred assignments (i.e. `a, *b = [1, 2, 3]`) pose a challenge, since their implementation depends heavily on the
work of the list team. We have already added ast and parsing support for starred assignments, and we have
scaffolding in place to type check them. However, getting them to work for arbitrarily sized lists could prove a
formidable challenge. We will try completing this by the March 11th deadline, but our success will depend on the list
team's progress

```python
a, *b, c = [1, 2, 3, 4]
a == 1
b == [2, 3]
c == 4
a, *b, c = [1, 4]
b == []
```

### Chained Assignments

Chained assignments (i.e. `a, b = b, c = [1, 2]`) are very doable. We could easily extend our existing code to
support chained assignments. If we find that starred assignments are too difficult to implement in one week,
implementing chained assignments in their stead would be a very attainable goal.

```python
a, b = b, c = [1, 2]
a == 1
b == 1
c == 2
```

### `_` Variable

One challenge we've also encountered is agreeing on the behavior of the `_` variable. Since it's conventionally used
to indicate the user is ignoring that part of the assignment (e.g. `_, *a = [1, 2, 3]` indicates the author only
cares about the `*a` part of the assignment), one option is to ignore any assignments to `_` to optimize assignments.
However, within Python, `_` can be accessed like any other variable.

At present, we treat it like any other variable. We have two options moving forward:

- Continue to treat as a variable. This is the simplest case and doesn't require any special handling. The downside to
  this is we can't handle statements like `a, *_ = (1, 2, False)` since `_` here would need to be a list of types `int`
  and `bool`. Additionally, given the current system of requiring variable types to be declared, usage of `_` requires
  declaration first.
- Change it to be a special "drop/ignore" symbol. Compile time the value is dropped. This breaks patterns such as
  `[_ + 1 for _ in range(10)]` though since we would require `_` to be an unreadable symbol (akin to `/dev/null`).
  <!-- Yes, I know /dev/null reads out a stream of 0s, but the comparison to being a trashcan is apt -->

## Programs From Proposal to Finish by March 11th

In the case that the list team's progress permits us to finish the splat operator:
```python
# _ is throwaway either by design or convention
a: int = 0
a, _ = (1, 2)
assert a == 1

# Splat operator
a: int = 0
b: [int] = None
c: int = 0
a, *b = (1, 2)
c, *_ = (1, 2)
assert a == 1 and b == [2] and c == 1

# Empty splat operator
a: int = 0
b: int = 0
c: [int] = None
a, b, *c = (1, 2)
assert a == 1 and b == 2 and c == []

# Single splat at any location
a: int = 0
c: [int] = None
b: int = 0
a, *c, b = (1, 2, 3)
assert a == 1 and c == [2] and b == 3

# Splat always creates a list
b: [int] = None
c: [int] = None
_, *b = [1, 2, 3]
assert b == [2, 3]
_, *c = (1, 2, 3)
assert c == [2, 3]

# Assignment happens in a left to right order.
# Destructured assignment can happen at particular indicies in arrays.
x: [int] = [0, 1]
i: int = 0
i, x[i] = 1, 2         # i is updated, then x[i] is updated
assert i == 1 and x == [0, 2]
```

Otherwise focus on chained assignment program:
```python
# Assignment targets are performed entirely from left to right
a: int = 0
b: int = 0
x: int = 0
a, b = x, a = 1, 2
assert a == 2 and b == 2 and x == 1
```

## Biggest Challenges

One of our challenges was determining the best way to type check a destructured assignment. Designing the type
checking logic with starred assignments in mind was particularly tough, since you don't immediately know how many
values will be assigned to the starred target. However, I feel like we eventually found a solution that is both simple,
understandable, and extensible.

Another challenge that we encountered was how to develop features that are dependent on other in-progress features.
Due to the nature of this project, many teams are developing interdependent features concurrently. Because of this,
we were unable to progress in either of our main goals, tuple and list destructuring, simply due to the fact that tuples
and lists don't exist quite yet. To account for this, we decided to implement a feature that's not in Python, object
destructuring. This still provides progress to our goals however, as we believe that the difference between accessing
object and tuple fields will be quite minimal. So we believe that only a few changes to our code will be necessary to
provide support for tuple destructuring when they are ready.

## Week 10 Update

Over the last week, we added destructuring support for lists, including both destructing individual assignments and
the starred operator. Additionally, we fully implemented tuples, including support for bracket lookup and destructuring
(albeit _without_ supporting starred assignment). Adding these features and ensuring they worked with other
teams' code was a challenge, but we wrote a comprehensive unit test suite to ensure everything functions as intended.

However, there are still some additional features we could foresee implementing if allotted more time.

### Chained Assignments

Chained assignments have been a stretch goal since the beginning of this project. While we didn't have time to
implement them, we did design our ast item in a way that could be extended to support them. By changing the
`destruct: Destructure<A>` attribute of the assignment statement to `destruct: Array<Destructure<A>>` or an equivalent
type, we could easily parse a chained assignment and represent it in the ast. Our type checking and compilation code
could even be kept largely the same, just applied to every `Destructure` object in the array from left-to-right.

Adding this feature would allow us to support programs like the following.

```python
head, *rest = *beginning, end = [1, 5, 25, 125]
head == 1
rest == [5, 25, 125]
beginning == [1, 5, 25]
end == 125
```

### Tuple spread operator

Currently, tuples do not support the spread operator. We have implemented the type checking logic to ensure every
item in a subsection of a tuple is assignable to a given list, but we have not added the necessary compiler
logic yet. Since tuples are laid out in memory slightly differently than lists (lists have metadata while
tuples do not), adding the compiler logic would require tweaking the existing spread operator logic for lists.
However, completing this feature would not be a large challenge.

Adding this feature would allow us to support programs like the following.

```python
# bool and int are both assignable to type object, so we can spread them into an object array
rest: [object] = None
n1, *rest, n2 = (5, True, 11, False, 9)
rest == [True, 11, False]
```

### Additional tuple features

There are several additional tuple features we could support in our application:
- To simplify type checking, the argument to a tuple's bracket lookup must be an integer literal. Otherwise, we cannot
  determine the type of the item being accessed at compile time. However, we could add support for using integer
  variables in bracket lookups if _every_ item in the tuple was assignable to the target location.
- Currently, we don't support any builtin functions for tuples. However, we could improve our implementation by
  supporting functions like `print`, `len`, etc.
- Python automatically converts expression lists to tuples in many circumstances. For example, Python infers to
  return a tuple from the expression `return a, b` even though `a` and `b` are not explicitly written as a tuple.
  This is especially relevant to assignments, as we commonly see `a, b = c, d` as shorthand to destructure an implied
  tuple `c, d` to the targets `a, b`. Supporting the creation of tuples from expression lists would be a large
  undertaking, especially since lezer-python does not have a special token for expression lists. We would need to add
  additional logic in several places to check for a comma after an expression, but it is certainly doable.

Adding these features would allow us to support programs like the following.

```python
# all items in the tuple are assignable to object, so we can use an index that isn't determined until runtime
obj: object = None
i: int = randint(0, 5)
obj = (1, True, 10, False, None, Object())[i]

# add support for tuple builtins, including print and len
tupel: (int, bool) = None
tupel = (10, True)
print(tupel)       # prints "(10, True)"
print(len(tupel))  # prints "2"

# automatically yield a tuple when we encounter an expression list in different scenarios
a, b = c, d  # treat c, d as a tuple and destructure

def doubel_tupel(a: int, b: bool) -> (int, bool):
  return a * 2, not b
doubel_tupel(100, False)  # returns the tuple (200, True)
```
