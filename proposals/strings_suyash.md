# Strings - Proposals

Implementation: https://github.com/suyashmahar/py-wasm

## Members
- Suyash Mahar

## 10 Representative examples

### #1

Statically allocating strings:  

```python
hello_world: str = "Hello! World"
```

### #2

Adding two strings to create a new string:  

```python
a: str = "first"
b: str = "second"
c: str = a + b
```

### #3

Printing strings:  

```python
print("Printing a string!")
```

### #4

Slicing character from a strings:

```python
c: str = "This is a number: 1"[18]
```

### #5

Slicing a substring from a string:

```python
hello_world: str = "Hello! World"
hello: str = hello_world[0:6]
```

### #6

Slicing a string with a step value:

```python
numbers: str = "1 2 3 4 5 6"
numbers_without_space = numbers[0:11:2]
```


### #7

Getting length of a string:

```python
test_str: str = "String of length 19"
print(len(test_str) == 19)
```

### #8

Escape sequences `\n`, `\\`, `\t`:  
(tabs expands to 4 spaces)

```python
test_string: str = "\tThis line is tabbed\nThis is not\nNew lines with: \\n, tabs with \\t"
```

### #9

Comparing two strings:

```python
test1: str = "equal"
test2: str = "equal"

print(test1 == test2)
```


### #10

For loop iterator, create a variable of type `str` and assign the next
value:

```python
hello_world = "Hello! World"
for var in hello_world:
     print(var)
```

## A description of how you will add tests for your feature.

Some tests that would be helpful for evaluating the implementation:  
1. Verify the static allocation of string and ensure that it ends with
   a NULL character.
2. Verify adding two string allocation creates a new string with
   characters from both the strings and a terminating NULL character.
3. Verify equality operator for the strings.
4. Test the translation of escaped characters in a string.

## A description of any new AST forms you plan to add.
1. Add a new `Value` type of tag `"str"`.
2. Add a new `Type` type of tag `"str"`.
3. Add a new `Expr` type of tag `"intervalExp"` that handles the
   slicing syntax (e.g., `[1:2]`).
4. Add a new field `iType?: Type` to represent the value type for
   every `Expr`.
   
**For 3**
```typescript
export type Expr =
  | { iType?: Type, tag: "intervalExp", pos: Pos, expr: Expr, args: Expr[] }
```
   
**For 4**
```typescript
export type Expr =
  | { iType?: Type, tag: "intervalExp", pos: Pos, expr: Expr, args: Expr[] }
  | { iType?: Type, tag: "num", pos: Pos, value: number }
  | { iType?: Type, tag: "self", pos: Pos }
  | { iType?: Type, tag: "none", pos: Pos}
  | { iType?: Type, tag: "bool", pos: Pos, value: boolean}
  | { iType?: Type, tag: "id", pos: Pos, name: string }
  | { iType?: Type, tag: "memExp", pos: Pos, expr: Expr, member: Name }
  | { iType?: Type, tag: "binExp", pos: Pos, name: string, arg: [Expr, Expr] }
  | { iType?: Type, tag: "unaryExp", pos: Pos, name: string, arg: Expr }
  | { iType?: Type, tag: "funcCall", pos: Pos, prmPos: Pos, prmsPosArr: Array<Pos>, name: Expr, args: Array<Expr> }
  | { iType?: Type, tag: "string", pos: Pos, value: string }
```

## A description of any new functions, datatypes, and/or files added to the codebase.

New datatypes in compiler.ts:
1. `tempHeapPtr: number`: heap pointer that is set before compiling,
   the codebase then increments it on every static string
   allocation. On completing the compilation, the runtime then sets
   the WASM memory with the new value.
2. `codeGenString()`: Function to generate code for strings.

## A description of any changes to existing functions, datatypes, and/or files in the codebase.
1. Add a new case to the function `traverseExpr()` for the node type
   `"String"`.
2. Add a new case for `typeStr` of value `"str"` to `parseType()`
   function.
3. Change the function signature of all the functions in `tc.ts` to
   add support for generating the decorated AST.
4. Add support for typechecking strings in comparator (`==`, `!=`) and
   addition (`+`) operators to function `tc_binExp()`.

## A description of the value representation and memory layout for any new runtime values you will add.
All strings will be stored as NULL terminated ASCII sequence. The
pointers to the string will point to the first character of the
string.

New functions in `repl.ts` for the WASM runtime:

1. `$str$len` to calculate length of the string, takes a single pointer.
2. `$str$concat` to concatenate two strings, takes two pointers.
3. `$str$slice` to slice strings, takes the pointer to the string and 3 arguments

Pointers to a string are represented using a 64-bit values with their
60th bit set and lower 32 bits representing the heap offset.

## A milestone plan for March 4 – pick 2 of your 10 example programs that you commit to making work by March 4.

Static allocation of strings and addition (#1 and #2)
