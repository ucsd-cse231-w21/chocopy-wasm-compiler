Within the proposals/ directory, submit a file called your-project.md that contains the following:

1. 10 representative example programs related to your feature. For each, a description of how their behavior will be different/work/etc. when you are done.
    * Add
    * Sub
    * Mult
    * Div !!
    * Print
    * Bignum as expression
    * Adding a regular number and Bignum
    * Mod !!
    * == != > < >= <=
    * Typing: can't compare int and bool
    * Big nums in memory are immutable
    * How to handle numbers as reference:
        
        ```python
        a:int = 3
        b:int = 3
        x:object = None
        y:object = None

        x = a
        y = a
        print(x is y) # returns False
        ```
        
2. A description of how you will add tests for your feature.

    Tests will be added in two of the test files. We will add tests to
    parser.test.ts that ensure that arbitrarily large integers are correctly
    parsed from the program and stored in the AST. Additionally, we wil add
    tests to runner.test.ts to run the representative programs above, as well
    as other tests to ensure the correct runtime behavior of Python Bignums.

3. A description of any new AST forms you plan to add.

    Because the implementation of arbitrarily-large integers does not result in
    a change to the existing syntax of ChocoPy, we will not need to make any
    substantial changes to the AST structure. However, we will have to modify
    the AST type for number literals by replacing its `value` property to have
    TypeScript type `BigInt` instead of `number` in order to be able to
    accomodate arbitrarily large integer values.
    
4. A description of any new functions, datatypes, and/or files added to the codebase.

    While Python Bignums can be of any arbitrary size, the representation of
    such numbers in WASM is limited to 32-bit words. Thus, to allow Bignums to
    be represented, we will implement a function in the compiler that will
    take as input a BigInt storing the integer value of the Bignum, and output
    an array of 32-bit words encoding that integer value in conformance with
    the Python3 standard. To allow for printing of Bignums, a decoding function
    will be implemented as well, which will take as input an array of 32-bit
    words and output the integer value of the encoded Bignum as a TypeScript
    BigInt.

    The new representation of integer values will result in significantly
    increased complexity to basic arithmetic operations. We intend to
    implement the arithmetic operations as built-in functions within WASM. We
    expect to add a new file in the codebase where these built-in functions
    will be defined, though this effort will be done in cooperation with the
    built-in function team.
    
5. A description of any changes to existing functions, datatypes, and/or files in the codebase.

    We will modify the files in the codebase as follows:
    * The files `ast.ts`, `tests/parser.test.ts` and `tests/runner.test.ts`
      will be modified to add test cases and support for Bignums as described
      earlier in this document.
    * `Parser.ts` will be modified slightly such that literal numbers in the
      program will be parsed regardless of size, and stored in a TypeScript
      BigInt value rather than TypeScript number value
    * `type-check.ts` will not need to be modified as the type-checking rules
      that apply to integers as already defined do not change as a result of
      increased capacity of Bignums.
    * `compiler.ts` will require changes as follows:
      * Case `num` in function `codeGenLiteral` will be modified to generate
        WASM code that allocates integer values in the heap (similarly to the
        current implementation of object construction) and places a reference
        to the allocated memory location on the stack.
      * The function `codeGenBinOp` will be modified to generate WASM code that
        calls built-in WASM functions implementing the arithmetic and relational
        operations, as the simple `i32` WASM instructions would no longer be
        sufficient to implement arithmetic operations. A similar modification
        will be made to the `UniOp.Neg` case in function `codeGenExpr`
    * Additional changes will be required in `runner.ts` and `repl.ts` to ensure
      correct printing of Bignum integers when they are returned from execution
      or passed to the `print` function. As integer values will be passed by
      reference rather than by value, code will have to be added to these files
      to extract the integer value from WASM memory and decode it for printing.

    As an optimization, we are considering having the compiler allocate literal
    integer values defined in the program into WASM memory prior to execution.
    This will require the following additional changes:
    * The `GlobalEnv` structure will be modified to add a `Map` mapping literal
      integer values to corresponding memory locations, similarly to the map
      for global variables.
    * The function `augmentEnv` in `compiler.ts` will be modified to allocate
      offsets for literal integer values and set those to the `GlobalEnv` map
      as described above.
    * Code will be added to `runner.ts` to inject the encoded literal integer
      values into the WASM memory at the correct offsets just prior to
      execution.
    
6. A description of the value representation and memory layout for any new runtime values you will add.
    All integer values will be treated as Bignums, and will be stored as
    objects on the heap in 32-bit words, conforming to the Python3
    standard as follows:
    * The first word will be signed integer, where the sign represents the
      sign of the actual value of the Bignum, and the magnitude indicates
      the number of additional 32-bit words that follow.
    * Subsequent words will encode the magnitude of the Bignum value,
      with 30 bits contained in each word, starting with the least
      significant 30 bits.
    * When an integer is stored in a variable or passed as an argument to a
      function at runtime, it will be represented as a WASM i32 value
      containing the memory location of the Bignum value
    
7. A milestone plan for March 4 – pick 2 of your 10 example programs that you commit to making work by March 4.
    * For Mar 4 returning expression and print
