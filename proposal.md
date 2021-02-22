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

    * Replace NUM with BIGNUM
    * q - do regular nums exist or is it all bignums?
    
3. A description of any new AST forms you plan to add.

    * Rename "number" to "bignum" etc
    * Literal type value is now BigInt
    * q - List in AST? do we use a list structure or class linkedlist
    
4. A description of any new functions, datatypes, and/or files added to the codebase.

    * Possibly a new file to get binary operators.
    * String/BigInt into memory representation and vice versa.
    * If pre-allocating - environment map from literal to memory location
    * "  " - a function to allocate memory space and store literals
    
5. A description of any changes to existing functions, datatypes, and/or files in the codebase.
    * In parse: parse BigInt instead number
    * In TC: no changes - nums are still nums
    * In CodeGen: 
        
        ```typescript
        function codeGenLiteral(literal : Literal) : Array<string> {
            switch(literal.tag) {
                // Literal is now an address in memory referencing bignum object
                case "num":
                    return ["(i32.const " + literal.value + ")"];
                    
                // ...
            }
        }
        ```
        
        ```typescript
        function codeGenBinOp(op : BinOp) : string {
        // almost everything will change here
        
        ```
    
6. A description of the value representation and memory layout for any new runtime values you will add.
    * Each big num will be a 32 bit reference to an object on heap memory
    
7. A milestone plan for March 4 – pick 2 of your 10 example programs that you commit to making work by March 4.
    * For Mar 4 returning expression and print
