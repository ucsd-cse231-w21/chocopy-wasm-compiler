# Testing Proposal

## Design



## Evaluation/Functionality

We plan on generating all programs that can be created from our [AST](../ast.ts). 
For now, we plan to omit loops and recursive functions but we will modularize our
program generator to easily extend future definitions as necessary.

Our program generation grammar will include:
- Literal: (0,1,True,False,None)
- Variable assignments 
- Binary operations
- Unary operations
- Functions
    - Function Defintion
    - Function Call
- Classes
    - Class Definition
    - Class Attributes & Lookups
    - Class Construct
    - Method Calls

In order to evaluate the correctness of our generated Python programs, we will
create two subprocesses, 1) to run the Python program natively and 2) to
compile the Python program to WASM, and evaluate the stdout/stderr of each subprocess.

Users will still be able to write and run local unit tests via `npm run test`.
Our fuzzing framework will instead be avaiable with `npm run fuzz`. This testing
script will continually generate new programs of interest, evaluate the
programs, and write the evaluation results to a file.


## Milestone
Our milestone for March 4th is to finish program generation for a subset of our AST and fully implement the testing & evaluation loop. 

The subset of our AST we plan to finish includes everything but *Classes*:
- Literal: (0,1,True,False,None)
- Variable assignments 
- Binary operations
- Unary operations
- Functions
    - Function Defintion
    - Function Call

## References
- [CSmith](https://www.cs.utah.edu/~regehr/papers/pldi11-preprint.pdf)