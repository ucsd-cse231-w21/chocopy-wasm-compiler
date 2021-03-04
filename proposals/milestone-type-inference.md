# Milestone 1 (3/4/2021) for Type Inference

1. Code and tests demonstrating that the 2 programs you chose from your proposal are working as expected

   - To reach our first Milestone Goal, we extended the existing VarInit infrastructure to support type inference for variables at the global, function, and class level when types are not provided by the programmer. 

   - NOTE: At this time all variable declarations must appear before statements. 

   - Variables may also be assigned arbitrary expressions at the first use. 

   - At this time we do not support inference for arbitrary expressions (calls, method calls, and class constuction), which breaks some of the existing tests due to the interaction between REPL and type inference. For example, when a variable `c` of type `C` is declared as follows: `c: c = None` and then later at REPL initialized with `c = C()`, this will throw an error because we'll try to infer the type of `c` from the second assignment at REPL, which at this time is unsupported. 

   - Note also that our Program 4 (see below) works as expected.
      ```
        # Program 4
        x = (1 + 3) * 2
        y = x * 2
        z = x + y
      ``` 
      

2. A description of which examples will work by March 11, including any updates you want to make to the examples you plan for March 11 (it’s OK to scale back or up depending on where you got!)

   - We have chosen to drop Program 3 from our previous proposal. 
   - We have presently also decided to (potentially, most likely) drop proper Generics from our program. We have realized that a full implementation of a type-inference algorithm is a prerequisite for Generics, and so we are re-scoping to first attempt to get a working type inference algorithm for the rest of ChocoPy before considering Generics.
     - Programs 8 and 10. 

   - By March 11th, we aim to deliver: 
     - Programs 5, 6 and 7. 
     - Program 5 will require significant changes due to the fact that variable initializations are not treated as statements at present. 
     - As a 'stretch goal', we would like to do global type inference so that the type signature of functions can be inferred without type annotations (e.g., `def f(x,y):...` could be inferred). Along this line, we would like to get to a structural sub-typing algorithm to handle classes (similar to Ocaml's inference algorithm.)

3. A description of the biggest challenge you faced in your week of implementation

   The biggest change (and thus challenge) of our implementation this week was allowing for *optional* type tags when doing variable assignments. E.g., when 'declaring' a variable, one could write `x: int = 5` OR `x = 5`, and either declaration would result in `x` being correctly typed and stored in the environment. This involved adding logic to the parser and compiler that essentially merges variable 'declarations' and variable 'assignments'. This was the biggest challenge, as the parser/typechecker/compiler uses the the `varInit` node in the AST frequently. Presently, we settled on doing a series of lookups, where the *first* time a variable `x` is assigned a value, it is treated as a `varInit`, and every subsequent time an assignment is done, we verify that `x` lives in an environment where it was declared. Moreover, there were some other sub-challenges that arose from trying to overcome our biggest challenge of merging 'declarations' and 'assignments':

   - We had to make sure that type environments were correctly updated during type checking and inference. This is crucial since if a variable `x` is defined as `x = y`, and this is the *first* assignment for `x`, then this 'counts' as as declaration, which means that we must *infer* the type of `x` by inspecting the type of `y` (which was previously inferred). Note this also extends ChocoPy to declare variables in terms of expressions which may contain (previously declared) variables. In contrast, base ChocoPy can only handle variable declarations with literals.
   - We had to make sure that parameters in function declarations get stored in the environment. Consider the following program:

   ```
   def f(x : int, y : int) -> int:
     x = x + y
     return x
   ```
   In order to prevent `x = x + y` from being treated as a 'variable declaration', it is neccesary to make sure that `x` was added to the local environment by inspecting the parameter list of `f`. This bug was easy to fix, but moderately difficult to pin down.

   In conclusion, the biggest challenge of our implementation thus far was making sure that the logics of variable declaration/assignment work as intended.

