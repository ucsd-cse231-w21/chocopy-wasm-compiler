* Code and tests demonstrating that the 2 programs you chose from your proposal are working as expected

  Included in commit # 1b4e23aa7c9c49172148a74dd041f6d38ac5c241

* A description of which examples will work by March 11, including any updates you want to make to the examples you plan for March 11 (it’s OK to scale back or up depending on where you got!)
    
  The ten examples we gave in our first proposal were:
    
    1. ✓ Bignum as expression
    2. ✓ Print
    3. ✓ 32 bit numbers and big numbers are the same to the programmer
    4. Addition and subtraction
    5. Division and multiplication
    6. Mod 
    7. Binary operators: == != > < >= <=
    8. Operations with differently-sized operands
    9. ✓ Typing: can't compare int and bool
    10. Big nums in memory are immutable

  We have completed 1, 2, 3, and 9. By March 11 we think we can complete all of the examples. If we have extra time, we can also re-write our builtin functions to work on big-nums. An example for this would be:
  
    ```python
    print(abs(-4294967296))
    ```
    
  This program would print `4294967296`.

* A description of the biggest challenge you faced in your week of implementation

  One of the biggest challenges we faced was planning how our code would interact with other groups' code. This involved working with the memory group to agree on a way to tag literals that would work for both groups. After planning the tagging scheme we had to implement encoding and decoding values so that they wouldn't break other groups' tests.

  
