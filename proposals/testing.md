# Testing Proposal

## Design


### High Level Design
Our goal for this project is going to be automated compiler fuzzing, similar to Csmith(cite).
We will generate random programs based on the grammar of (extended) ChocoPy, henceforth eChocoPy. 
For each grammar production, we generate a required target from the allowable targets. If the production 
is nonterminal, that production is recursively generated. Each production will be generated according to 
a probability table of a appropriate productions.

Functions, variables, and classes require special generation. We will preemptively generate some random
number of functions, variables, and classes, and maintain these in a global environment. When generating
function and method bodies, we will add the parameters to the global environment in the context of that
function or method to create a function environment. Any production that selects a variable to produce 
will select from the set of defined variables in the environment, and functions and classes are also
selected from the environment when the appropriate production is selected. Generated function
and method bodies have access to all types in the environment, so they can call other functions or methods
within their scope. However, functions are not allowed to make recursive calls, as we currently
cannot plan to make sure they terminate. 

This ensures that the programs generated are well-formed ChocoPy programs. By 
generating according to the grammar of the language, we ensure that programs
are valid eChocoPy. We make this decision because we don't believe programs that
are not intended to parse correctly generate interesting compiler errors. However,
parsers incorrectly parsing correct programs will still be caught by this fuzzing
approach.

The probability table will be constructed in such a way that the vast majority of generated programs
are valid eChocoPy. For instance, if we are generating operands for a + operator, we will have a very 
high chance to generate integer-typed operands on both sides, and a very low chance to generate
non-integer operands. We take this approach because we believe that compilers properly throwing type
errors are interesting, as this tests the robustness of the type-checker, but once one class of
type errors is found, continuing to generate that type error is not very interesting. Therefore,
we would like most of our programs to type-check. Notably, this differs from Csmith, because Csmith 
is concerned with edge-case bugs in mature compilers. Since we are testing a very immature compiler,
we consider errors like this to be more interesting.

To serve as our source of truth, we will use the Python interpreter, and run all generated programs 
through Python as a source of truth. We make this selection for two
major reasons: a Python interpreter will be able to run all eChocoPy programs, since eChocoPy is
a subset of the Python grammar, and the semantics of Python should be similar enough to eChocoPy
that they should produce the same results. Since Python does not expose the value of programs, we
will wrap our program in a print statement, and then read stdout for the final value of the program, 
which we will then parse into the Value type, contained in ast.ts. We may re-evaluate this area if 
any of the proposals result in significantly different semantics than Python, but we don't expect 
this to be the case. 

To simulate REPL behavior, we will break our programs up into logical components. Each program can be 
broken up into any number of logical components, but only at the statement level. This ensures
that each component is also a valid eChocoPy program in the presence of a REPL. Then, we will compare
the result of evaluating components sequentially in the REPL with evaluating components cumulatively in
Python-that is, if we want to evaluate component 3, we would feed component 3 to the REPL, but feed
the concatenation of components 1,2,3 to Python. 

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
