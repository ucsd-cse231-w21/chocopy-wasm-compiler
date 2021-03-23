# Testing Group Milestone Report

## Progress Report

### Program Fuzzing

We have successfully implemented a program that randomly generates valid Python programs.
These programs include:

- Literals
- Variables(global and function scope)
- Binary operations
- Unary operations
- Function Calls
- Function Definitions
- If statements

We do not generate the pass statement, because we do not consider it an interesting construct.
Additionally, we do not generate loops, as loops have the additional complication that they must
be guaranteed to terminate to generate testable programs. We also don't currently generate
global variable assignments inside functions due to the lack of support in our ChocoPy-Wasm compiler 
for the `global` keyword.

Variables required some special treatment that we failed to foresee in our proposal. We currently
maintain a variable environment that tracks current variables in scope by type.  Our current 
implementation, when it selects a variable for generation, has a fixed probability to either use 
an existing variable of the correct type, or generate a new variable in local scope. 
Then, when all the statements are finished generating, we then generate the required 
variable definitions at the top of the program. Functions are treated similarly; whenever a function
call is selected for generation, we randomly select either an existing function of the correct
return type to generate, or create a new function signature with the required return type.
Then, when main body generation is finished, function definitions are generated according to the used
function signatures, with random bodies. Notably, it's possible for these function bodies to
generated function calls of their own. If they call new functions instead of existing functions, 
those functions are created as nested functions. We decided not to have a chance of generating 
an undefined function call because we considered that an uninteresting error within a compiler.

For literals, as per our proposal, we currently only generate the literals 1, 0, True, False, and
None. We found that we were able to generate a reasonable range of integers by generating arithmetic
expressions with only the numbers 0 and 1, However, we found that having a roughly equal change to 
generate either 0 or 1 resulted in a significant amount of divide-by-zero errors, as generating a 0
at any point in the right operand of an integer division or modulus resulted in a very high chance
that the entire right operand expression evaluated to 0. As a result, we have tuned the probabilities
such that 0 is impossible, as we do not believe divide-by-0 is an interesting error, as it is
thrown in the Wasm runtime instead of the compiler.

Our program generation also wraps all unary expressions in parentheses. This is because we found
that Python's operator precedence often resulted in the unary expression applying to unintended
expressions, and as a result throwing a type error. We don't consider operator precedence parsing
to be a particularly interesting error, as the parser grammar is not written by us. However, it
is possible that we may revert this decision for a while, to stress-test the lezer parser. 

Lastly, we require the "value" of a program to perform testing. Because the Python interpreter
does not return us the value of the program, if the last statement of a program is an expression,
we wrap it in a print() function, and parse standard out to recover the value of our program. 
This wrapping is only done on the version of the program sent to the Python interpreter, and not
on the version of the program sent to our ChocoPy-Wasm compiler. Other than this modification, 
the programs sent to both are identical. We have confirmed with the type-inference group that their 
semantics will match Python's semantics(as their functionality extends ChocoPy), and intend to
confirm with other groups that their semantics will also be at least a subset of pythjon

Below is an example of a generated program(LONG):

```python
number_0:int = 1
number_1:int = 1
number_2:int = 1
number_3:int = 1
number_4:int = 1
number_5:int = 1
number_6:int = 1
number_7:int = 1
number_8:int = 1
number_9:int = 1
number_10:int = 1
number_11:int = 1
number_12:int = 1
number_13:int = 1
bool_0:bool = False
bool_1:bool = False
bool_2:bool = False
bool_3:bool = False
bool_4:bool = False
bool_5:bool = False
bool_6:bool = False
bool_7:bool = False
bool_8:bool = False
def func_number_0():
  number_14:int = 1
  number_15:int = 1
  bool_9:bool = False
  bool_9
  1 - (-(-number_14)) != 1 <= number_15
  1 % 1
def func_number_1():
  bool_9:bool = False
  bool_10:bool = False
  bool_11:bool = False
  1
  bool_9 = (not bool_10)
  bool_11
  bool_0
def func_number_2(func_number_2_param_0: int):
  func_number_2_param_0:int = 1
  def func_number_3():
    number_15:int = 1
    (-number_13)
    number_15
    True
  def func_none_0(func_none_0_param_0: int):
    func_none_0_param_0:int = 1
    1
  None is None is None is None is None is None is None is None is None is func_none_0(func_number_3())
if True:
  None
else:
  if 1 >= 1 + 1:
    number_0
  else:
    None
    if bool_0:
      if (not bool_1):
        number_0
        1
        bool_2 = False
      elif (not True) :
        func_number_0() * (-1) < number_1
      elif bool_3 :
        number_2 = 1
        if True:
          False
          if (not bool_4):
            if (-number_1 * func_number_0() + number_2) > 1:
              (-1) // 1 * func_number_0()
              True
            else:
              number_3
              if (not (not bool_5)):
                func_number_0() > (-1)
              else:
                func_number_1() % number_4 + number_5
              1
              func_number_1()
              None
              bool_6 = True
            1 // number_4
          else:
            if True:
              if number_3 != func_number_1():
                number_1 = number_6
              else:
                1 % func_number_1()
            else:
              func_number_1() <= number_7 % 1
          number_8 = func_number_1()
        elif True :
          number_9 = func_number_0() % func_number_1()
        else:
          func_number_1()
          1
          func_number_2(1)
          func_number_0()
          if bool_7:
            if (not bool_8 or False):
              number_10 = number_6
              number_11 = 1
            func_number_1() > number_12
          number_13
    else:
      bool_8
    func_number_1()
print(1)


```

We provide the command `npm run fuzzonce` to generate a program and run it through Python.

### Cypress testing framework

We have additionally included support for the Cypress testing framework. We make both
the existing Mocha/Chai-based testing framework as well as the Cypress framework available to 
other developers, with developers choosing between the two based on their own needs and comfort 
level. We include an example unit test to demonstrate the use of Cypress, and our hope is that 
groups who need to test REPL behavior in particular will choose to write Cypress tests of their own
as well as the requisite Mocha/Chai tests to form a comprehensive suite of regression tests.

Additionally, we have integrated Cypress testing into the GitHub CI pipeline as a GitHub action. Any
PR or merge to the main branch will automatically trigger all Cypress tests in addition to all
Mocha/Chai tests. Our hope is that this will provide assurance that any changes to the main branch
will not break existing functionality.

## Goals for Final Project

With regards to our testing framework, we are generally happy with where we are at for this 
milestone. The addition of Cypress provides a programmatic way for groups to test how their
features interact with the REPL, and the existing Mocha/Chai testing framework was already
sufficient for testing other steps of the compiler. Therefore, we do not intend to extend
the testing framework in any way post-milestone.

### Automated Fuzzing

We will set up a fuzzing server running on the Google Cloud Platform that will automatically
generate programs via our automated code generation. This server will automatically generate
programs, run them through Python and retrieve either the error or the value of the program,
and run our ChocoPy-Wasm compiler using the Cypress framework on the same program. We intend to
break our program up randomly along logical code blocks, and feed these both to our REPL and 
Python to simulate REPL interactions. At each step, only the current block is sent to our REPL,
but the current block and all previous blocks will be sent to Python, and we will compare the
results. We expect that the result for each will be the same(confirmed with the type-inference 
group). Any differences will be considered failing tests, and the generated program, as well as
the outputs of both the Python interpreter and our ChocoPy-Wasm compiler will be saved to a file.
Thus, checking the fuzzer's progress simply involves checking for the existence of these files,
and manual confirmation and bug-hunting can be performed by running the offending program. 
Additionally, we intend to have our fuzzing server pull the repository whenever the main branch
has changes. We would like to set up a webhook in the GitHub repository to this effect, though
this particular change will require consultation with Joe and Yousef.

Additionally, we expect the basic design of our fuzzing server to remain the same. We will 
likely make bugfixes or other changes, but we do not expect to make design-level changes to
the fuzzing server. As a result, our post-milestone goals are all related to extending automatic
program generation to support more constructs.

### Program Generation and Future Extensions

We intend to extend the constructs generated by our program generation to as many 
constructs as possible from the following, roughly organized in order of priority:

Mandatory
- Classes, member access/assignment, and method calls

Likely
- Library function calls
- Default argument usage

Optional
- Loops
- Lists
- Strings
- Sets/Tuples, destructuring

Unsure how to do
- Garbage collection/memory management

We prioritize classes and their associated constructs, because they form the last major part of
ChocoPy from PA3 that we do not generate, with the exception of loops, and we plan to tackle them
in a similar manner to functions and variables-i.e generation based on usage. We expect there to be
some challenges in implementation, but nothing fundamentally unique, so we expect to finish at 
least this much. Inheritance is a tricker issue, but we will do our best to design generation
functionality that supports testing inheritance. The approach required will need some thought,
and we will likely discuss with Joe and Yousef the best way to perform this.

Library function calls should be very simple. From what we understand, the syntax of library function
calls will be identical to Python(barring default/keyword arguments that may not be supported). 
Thus, we simply need to add library function signatures to our environment of function signatures, 
and the corresponding calls should be generated with our existing framework.

Loops using the iterator implementation have the convenient property that they are guaranteed
to terminate so long as the iterator functions properly, as neither Python nor our subset support
infinite-length lists. It is possible to construct iterators that never terminate, but so long as
we do not generate such iterators, we should not have this issue. Currently, we intend to sidestep 
this problem entirely by only generating loops that use iterators over lists and range() constructs,
as those are guaranteed to terminate. For while loops, we would have to generate them in a much
more structured style that guarantees the generation of a counter-based condition as well as 
counter mutation in the correct direction inside the loop body. We expect there to be unexpected
hurdles here, so we place while loops at the bottom of the loop priority queue.

We expect lists to require the addition of a List type inside our generation code, as there are
operations that only lists are able to perform, and the interface for lists is not extendable,
so code that interacts with lists will only be able to use a fixed interface. Our code generation
will likely require that a list's elements are of the same (super)type. This is *more* restrictive
than Python, but since our code is statically type, we see no way around this restriction, and indeed
it is present in most statically typed languages. Aside from this restrictions, we expect our 
generation framework to be able to fairly easily generate list and element manipulations.

We are relatively unsure how to do strings. Our current approach involves the generation of 
random ASCII string literals, and manipulating them in a similar manner to lists, except that
we also prioritize calling print() on strings. Once lists are implemented, we are unlikely to have
to do too much work to support string generation. However, this topic will require more discussion
with the relevant groups as well as Joe and Yousef.

Unlike lists, sets and tuples have the additional syntactic complexity of destructuring. Outside
of destructuring, we expect the interface for sets and tuples to be a subset of the interface
for lists, so we will handle the generation for these constructs similarly to lists. Destructuring
will likely consist of a random choice of whether to generate a destructured form of an assignment
or the non-destructured form. This particular feature will require some extensive discussion
with the relevant groups as well as Joe and Yousef.

Default argument usage will require the selection of random amounts of arguments in a given function
to be generated with defaults, as well as the calls to those functions being generated with
a random number of arguments, skewed toward correct numbers of arguments(i.e acceptable with the
defaults defined), to be able to test both errors and correct usage of default arguments. Currently,
we think that the number of default arguments will be attached to the function signature, and our
code generation will respond accordingly. Additionally, since default arguments can potentially only
be literals, we may have to expand our literal generation to sufficiently test different default
arguments. However, these issues should not be overly difficult to solve, and we expect that should
we attempt default argument generation, it should not take too much time. However, we expect that
there will be relatively few bugs in this feature compared to the previous features.

We are unsure how to test garbage collection/memory management. We expect that class generation and
its associated constructs are sufficient syntactically to test memory management. However, 
just because a program has semantic correctness does not mean that the garbage collection is working
properly. For that, tests also need to track the amount of space used or wasted on the heap. The
Python interpreter does not expose this information to us in any way that we know of, so to obtain a 
correct amount of heap usage, we would have to track initializations generated inside our programs,
and then perform a check of the heap afterward. Though this is not impossible, it will be rather
complex, and validating the correctness of our checks will be tricky. Thus, we will consider 
testing memory management to be outside the scope of our current program generation, and rely
on the memory management group to produce unit tests for their implementation.

Given that we only have a week remaining, we only expect to finish class generation and maybe
library function calls. However, we completed our milestone work unexpectedly quickly. If this occurs
again, we may be able to work on the other items in the list. Otherwise, we leave it to future 
contributors to extend program generation to more completely test other feature.

### Progress Update
As of the project deadline (3/11), we have completed the generation of classes, as well as the setup of an 
automatic fuzzing server. We consider the rest of the program generation features listed above to be future work.

We also discovered a bug in python-shell, with issue [here](https://github.com/extrabacon/python-shell/issues/240). We have reported this as an issue in python-shell.
