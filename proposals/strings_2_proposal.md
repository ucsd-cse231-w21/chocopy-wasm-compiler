## Strings

### 10 representative example programs

1. Storing a string in a variable
    Example:-
     a:str = "Joe Politz"

2. Throw an error when single quotes are used to represent a string

    Example 1:-
     a:str = 'Joe'
    
    Expected output 1:-
     Parse error : INVALID string

3. Printing the string variable/any string
    Example 1:-
     a:str = "Joe Politz"
     print(a)
    
    Expected output 1:-
     Joe Politz

    Example 2:-
     print("Yousef Alhessi")

    Expected output 2:-
     Yousef Alhessi

4. Length of a string
    Example 1:-
     a:str = "Joe Politz"
     print(len(a))
    
    Expected output 1:-
     10

    Example 2:-
     print(len( "Yousef Alhessi"))
    
    Expected output 2:-
     14

5. Fetch a character in a string using its index
    Example 1:-
     a:str = "Joe Politz"
     print(a[2])
    
    Expected output 1:-
     e

    Example 2:-
     print("Yousef"[2+1])
    
    Expected output 1:-
     s

6. Concatenation of multiple strings
    
    Example 1:-
     a:str = "Joe"
     b:str = "Yousef"
     a = a + " " + b 
     print(a)
    
    Expected output 1:-
     Joe Yousef

    Example 2:-
     print( "Yousef" +  " Alhessi" )
    
    Expected output 2:-
     Yousef Alhessi

7. Comparisons (== and !=) operators for strings

    Example 1:-
     a:str = "Joe"
     b:str = "Yousef"
     print(a==b)
    
    Expected output 1:-
     False

    Example 1:-
     a:str = "Joe"
     print("ABC" != a)
    
    Expected output 1:-
     True

8. Slicing of strings

    Example 1:-
     a:str = "ABCDE"
     print(a[1:])

    Expected output 1:-
     BCDE

    Example 2:-
     a:str = "ABCDE"
     print(a[:3])

    Expected output 2:-
     ABC
    
    Example 3:-
     a:str = "ABCDE"
     print(a[1:3])

    Expected output 3:-
     BC

9. Using escape sequences ( \", \n, \t, \\ )

    Example 1:-
     a:str = "Joe\nYousef"
     print(a)
     print("He\"ll\"o")
    
    Expected output 1:-
     Joe
     Yousef
     He"ll"o

    Example 2:-
     a:str = "He\\\"llo"
     print(a)
     print("\tJoe\tPolitz")
    
    Expected output 2:-
     He\"llo
        Joe Politz

10. Invalid indexing of a string (throw error)

    Example 1:-
     a:str = "Joe"
     print(a[5])

    Expected output 1:-
     Index out of bounds

11. Throw a parse error for invalid escape sequences inside a string

    Example 1:-
     a:str = "Joe\oYousef"
     print(a")
    
    Expected output 1:-
     Parse error : INVALID string

    Example 2:-
     print(" He "aa" a ")
    
    Expected output 2:-
     Parse error : INVALID string


### A description of how you will add tests for your feature
The ChocoPy specs state the following of strings:
1. String(str) is a datatype.
2. A string can be initialized as a series of characters enclosed within double quotes.
3. \\, \n, \t, \" are the escape sequences allowed in strings.

The operations on strings are:
1. Storing a string in a variable.
2. Finding the length of a string (using len).
3. String comparisons (using == and !=).
4. String indexing, and fetching string characters using indices.
5. String concatenation.

We plan on designing test cases for each of the above operations to check if they work per the specification. We will also design cases to test that appropriate error messages are returned when the syntax is violated or invalid operations are encountered.

### A description of any new AST forms you plan to add

1. We will be adding a new {tag:"string"} to the existing Type.
2. A new {tag:"string", value: string, length: number} will be added to the Literal.
3. A new {a?:A, tag:"str_slicing", str:Expr<A>, start?: Expr<A>, end?: Expr<A>} in Expr to perform string slicing.
4. A new {a?:A, tag:"str_index", name: Expr<A>, offset: Expr<A>} in Expr

### A description of any changes to existing functions, datatypes, and/or files in the codebase

Changes in parser.ts

1. We need to add a new case "String" in traverseExpr function and call codeGenLiteral.
2. We need to add a new case "String" in traverseLiteral function where we would parse a string.
3. We need to add a new callName called "len" in traverseExpr in the case "CallExpression"
4. We need to add a new condition inside "MemberExpression" in traverseExpr to check for indexing and string slicing as well (Example: a[10], a[1:5])
5. We need to add a new case "Comment" in traverseStmt to check for any comments(#) in the program.

Changes in compiler.ts

1. We need to add a new case "string" in codeGenLiteral function where we need to allocate space for the string in the memory using our global offset variable.
2. In codeGenExpr, inside builtin1 case, we need to check if the callName is a "len" and generate code to return the length of the string
3. We need to generate code for "str_slicing" and "str_index" cases inside codeGenExpr
4. We need to check if the type of operands in "+" binary operation are strings. If so, we need to generate code for concatenating the two strings. Similarly, generate code to implement comparison operations  "==" and "!=".

Changes in type-check.ts  

1. We need to add a new case "string" in tcLiteral where we return a STRING.
2. Whenever we perform "str_slicing" or "str_index", we need to ensure that the variable/literal on which we are performing the slicing/index operation is of type STRING.
3. In binary operations such as "+", "==", "!=" we need to add another case where we check if the operands are both of type STRING or not.

### A description of the value representation and memory layout for any new runtime values you will add

1. Storing characters of strings 
We will be using ASCII values of different characters of the string to store them as i32 values in the memory. We will store the ASCII values of characters in continuous memory locations and we will return the address of the first character and store it in the variable used for representing the string.

2. Using a length parameter in "string" literal
We will use the length parameter in the "string" literal to store the lengths of string so that we can easily access the string lengths for different operations.

3. Memory after concatenation of two strings
For the below example:-
a:str="aaa"
b:str="bbb"
a=a+b

In such cases, we reallocate the variable a's address to point to a new memory location which constains the ASCII value of the starting character of the concatenated string.

### Milestone plan

The examples we are planning to complete by March 4th are:-

1. Storing a string in a variable
2. Printing strings
3. Fetching a character from a string using its index