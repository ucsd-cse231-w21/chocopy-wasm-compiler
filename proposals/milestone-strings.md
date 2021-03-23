## Strings milestone

### Code and tests demonstrating that the 2 programs you chose from your proposal are working as expected

#### Program 1 - Storing and printing strings
```python
assertPrint(
    "print-2-strings",
    `
  print("Compiler")
  print("Design")`,
    ["Compiler", "Design"]
  );
```

```python
assertPrint(
    "string-variables-printing",
    `
  x : str = "Compiler"
  print(x)`,
    ["Compiler"]
);
```

```python
assertPrint(
    "function-with-string-return-and-string-param",
    `
  def func()->str:
    a:str="Compiler"
    return a

  print(func())
    `,
    ["Compiler"]
);
```

```python
assertPrint(
    "class-with-string-fields",
    `
  class C(object):
    x : str = "Compiler"

  c1 : C = None
  c1 = C()
  print(c1.x)
  c1.x = "ABC"
  print(c1.x)`,
    ["Compiler", "ABC"]
);
```

#### Program 2 - Fetching a character from a string using its index

```python
assertPrint(
    "print-string-index",
    `
  print("Design"[2])`,
    ["s"]
);
```

```python
assertPrint(
  "print-negative-string-index",
  `
  print("Design"[-2])`,
    ["g"]
);
```

### A description of which examples will work by March 11

1. Length of a string

    Example 1:-

    ```python
     a:str = "Compiler"
     print(len(a))
    ```

    Expected output 1:-
     8

    Example 2:-

    ```python
     print(len("Design"))
    ```

    Expected output 2:-
     6

2. Concatenation of multiple strings

    Example 1:-

    ```python
     a:str = "Compiler"
     b:str = "Design"
     a = a + " " + b
     print(a)
    ```

    Expected output 1:-
     Compiler Design

    Example 2:-

    ```python
     print( "Compiler" +  " Design" )
    ```

    Expected output 2:-
     Compiler Design

3. Comparisons (== and !=) operators for strings

    Example 1:-

    ```python
     a:str = "Compiler"
     b:str = "Design"
     print(a==b)
    ```

    Expected output 1:-
     False

    Example 2:-

    ```python
     a:str = "DEF"
     print("ABC" != a)
    ```

    Expected output 2:-
     True

4. Slicing of strings

    Example 1:-

    ```python
     a:str = "ABCDE"
     print(a[1:])
    ```

    Expected output 1:-
     BCDE

    Example 2:-

    ```python
     a:str = "ABCDE"
     print(a[:3])
    ```

    Expected output 2:-
     ABC

    Example 3:-

    ```python
     a:str = "ABCDE"
     print(a[1:3])
    ```

    Expected output 3:-
     BC

5. Using escape sequences ( \\", \\n, \\t, \\ )

    Example 1:-

    ```python
     a:str = "Compiler\nDesign"
     print(a)
     print("He\"ll\"o")
    ```

    Expected output 1:-

     Compiler

     Design

     He"ll"o

    Example 2:-

    ```python
     a:str = "He\"llo"
     print(a)
     print("\tCompiler\tDesign")
    ```

    Expected output 2:-
     He\\"llo

        Compiler Design

6. Invalid indexing of a string (throw error)

    Already implemented, but requires some changes to be made by error-reporting group

    Example 1:-

    ```python
     a:str = "ABC"
     print(a[5])
    ```

    Expected output 1:-
     Index out of bounds

7. Throw a parse error for invalid escape sequences inside a string

    Example 1:-

    ```python
     a:str = "Compiler\oDesign"
     print(a)
    ```

    Expected output 1:-
     Parse error : INVALID string

    Example 2:-

    ```python
     print(" He "aa" a ")
    ```

    Expected output 2:-
     Parse error : INVALID string

### A description of the biggest challenge you faced in your week of implementation

The biggest challenge we faced was designing memory access for strings. We stored the ASCII values in contiguous memory locations for representation and stored the length of the string at the starting address which acts like metadata for the string. Accessing the memory location of strings in order to print them was another challenge. We solved this issue by creating the memory object in Webstart and using it to access the string memory location in the print_str function.

We had to make some changes in "construct" case in compiler.ts to accomodate string fields. We solved this issue by first allocating memory for class fields first which will store a reference to the location of the string.

class C(Object):
  s:str = "ABC"
  t:int = 8

In such a case, before we made changes, memory would have been allocated to the string "ABC" before allocating memory for the variable t. We made changes in "construct" case so that memory would be first allocated to the fields s and t before allocating memory to the string "ABC".

## Final submission

### Examples we were able to get to

**We were able to implement all the examples which we proposed in our original proposal.**

The major features that were proposed and have been implemented are:-

1. Storing and printing string literals

2. String indexing and substring slicing

3. Binary operations on strings (+, *, ==, !=, >, >=, <, <=)

4. Finding the length of a string using "len" function

5. Implementing escape sequences in strings

We had initially only proposed +, ==, != binary operations. But we extended our implementation to include additional binary operations: "*",  ">", ">=", "<", "<=".

### Three example programs or scenarios that would require extensions to our design

#### 1. Type conversion using "str()"


   Example 1:-

     a:int = 20
     b:int = 30
     print(str(a) + str(b))

    Expected output 1:-

     2030


   Example 2:-

     a:bool = True
     b:int = 1
     print(str(a) + str(b))

    Expected output 2:-
      True1

  We could add this feature by writing a function "convert_to_str" in compiler.ts which would take a literal value and iterate over all the characters in literal. Then it would store the corresponding ascii value of each character as part of the new string. The function should return the starting address of the string which would contain the length of the string. The locations following it would be used to represent the content of the string.

#### 2. Collection of string functions such as s.upper(), s.lower(), s.startsWith(), s.endsWith()


  Example 1:-

      a:str = "abcde"
      print(a.upper())

    Expected output 1:-
     ABCDE


  Example 2:-

     a:str = "XYZ"
     print(a.lower())

    Expected output 2:-
      xyz


  Example 3:-

     a:str = "CompilerDesign"
     print(a.startsWith("Com"))

    Expected output 3:-
     True


  Example 4:-

     a:str = "CompilerDesign"
     print(a.endsWith("Com"))

    Expected output 1:-
      False

  These functions can be implemented as methods of a string class. The class would contain a member variable which would be the string itself and would contain a host of member methods for the examples provided above. These functions can be easily implemented given our current representation of strings.

#### 3. Check if a certain phrase or character is present or not in a string using "in" and "not in"


  Example 1:-

     txt:str = "The best things in life are free!"
     print("free" in txt)

    Expected output 1:-

     True


  Example 2:-

     a:str = "XYZ"
     b:str = "A"
     print(a not in b)

    Expected output 2:-
      True

  We can implement this feature by iterating through all the characters of the substring to be searched in the main string. Although this would be an n! problem, we can use some clever algorithm techniques to come up with an efficient searching algorithm.
