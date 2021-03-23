* Code and tests demonstrating that the 2 programs you chose from your proposal are working as expected

  Included in commit # 1b4e23aa7c9c49172148a74dd041f6d38ac5c241

* A description of which examples will work by March 11, including any updates you want to make to the examples you plan for March 11 (it’s OK to scale back or up depending on where you got!)
    
  The ten examples we gave in our first proposal were:
    
    1. ✓ Bignum as expression
    2. ✓ Print
    3. ✓ 32 bit numbers and big numbers are the same to the programmer
    4. ✓ Addition and subtraction
    5. ✓ Division and multiplication
    6. ✓ Mod 
    7. ✓ Binary operators: == != > < >= <=
    8. ✓ Operations with differently-sized operands
    9. ✓ Typing: can't compare int and bool
    10.✓ Big nums in memory are immutable

  We have completed 1, 2, 3, and 9. By March 11 we think we can complete all of the examples. If we have extra time, we can also re-write our builtin functions to work on big-nums. An example for this would be:
  
    ```python
    print(abs(-4294967296))
    ```
    
  This program would print `4294967296`.

* A description of the biggest challenge you faced in your week of implementation

  One of the biggest challenges we faced was planning how our code would interact with other groups' code. This involved working with the memory group to agree on a way to tag literals that would work for both groups. After planning the tagging scheme we had to implement encoding and decoding values so that they wouldn't break other groups' tests.

-------------------  
* Extensions to big number design

  1. Additional operator support - including bitwise operators, shift operators, and (**) operator
  
    ```python
    x:int = 1
    x = x << 32
    print(x)
    x = ~x
    print(x)
    ```
    Currently, there is no support for bitwise operators, or the (**) operator. The program about should print `4294967296` the first time, then the bits should be negated and `-4294967297` will be printed the second time. This would require using the binary and unary operator interfaces that we've already defined, and adding parsing support.
    
  2. Optimizing temporary numbers
  
    ```python
    i:int = 0
    while i < 4294967296:
      i += 1
    # i is never used again
    ```
    Big numbers in our implementation are immutable. This allows the programmer to treat big numbers as if they pass by value, even though they actually pass by reference. However, this requires new memory to be allocated every time a new big number is created. In certain cases, such as the program above, this will create a huge memory overhead. Even though memory is not allocated for integers with magnitude less than 2^30, once `i` exceeds this value, a new big number will be created in memory on each iteration of the loop. It would be much more efficient to simply modify `i` in memory if we know that it will be used as a temporary or loop variable. This would require that we figure out how each number will be used and when it would be safe to modify in place vs. when a number needs to be immutable. 
   
  3. Decimal values
    ```python
    x = Decimal('0.123123123123123123123123123123123123123')
    x = x / 2
    print(x)
    ```
    While our current work allows us to represent arbitrarily-large integer values, we could extend this representation to floating-point values and allow for arbitrarily-precise decimal values. Currently Python supports this through its `decimal` class, as shown above, and allows the programmer to specify the precision to which operations are calculated. We can use much of our existing work to store the magnitude of any decimal number in memory to an arbitrary amount of digits. Then we will need to extend that representation to allow us to store the exponent of that decimal number to account for the floating point. The arithmetic operators can then implemented by developing appropriate algorithms for the floating-point arithmetic.

----------------
* Other extensions that we have considered include the following:

  4. Implementing binary and unary operators in WASM

     ```python
     x:int = 4294967296
     print(x + 1)
     ```
     All binary operators are currently defined through imported typescript functions. If the compiler had to be independent of a typescript environment we would need to create WASM function that perform basic operations. This would involve implementing an efficient algorithm in WASM to add, multiply, etc.
   
  5. Extended testing to make sure big numbers can be used in all other built in structures
  
     ```python
     for i in range(4294967296):
       print(i)
     ```
     Although big numbers should be completely interchangable with regular numbers in all programs, subtle bugs may exist with different teams working on different parts of the compiler. More tests should be added to ensure that big numbers work in every situation a regular number works.
    
  6. (Possibly better for builtin team) Provide functions to convert from ints to strings and vice versa
  
     ```python
     x:int = 4294967296
     y:str = ""
     y = bin(x)
     print(y)
     y = "4294967296"
     x = int(y)
     print(x)
     ```
     Python provides several utility functions to convert between strings and ints, including `str`, `bin`, `hex`, `int`, etc. With strings and ints both implemented in our compiler, we could also implement functions that convert between the two. This would involve working with the builtin and strings team, and finding an efficient way to do the conversions.
    
  7. BigNum in list or tuple
   
     ```
     list_num = [1,2,3,4294967296]
     print(list_num)
     ```
     We haven't checked with the list and tuple team with their implementation. It can be possible that in order for our bigNum to work in list, we need some extra  modification on the program.
    
