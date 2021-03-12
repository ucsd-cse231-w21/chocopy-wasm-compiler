# Closures/First Class/Anonymous Functions
## Project milestone
 
By March 4th, we've successfully implemented nested functions (w/o nonlocal declarations) without escape as decribed in our proposal.

##  A description of examples work by March 11
We are going to work on more complex examples of closures, including all the examples in the initial proposal, except those containing lambda expressions.

## A description of the biggest challenge in implementation
One of challenges is to settle to the input/output interface of each component in the compiling pipe line. For example, the `ea.ts` flatten the nested functions, and in this process, information is compressed. Some information is useful for later code generation. Therefore, we have to go back and forth several rounds to augment the interfaces.

Another challenge is tracking the function that is invoked. Since the function value is assignable, the call to same function value variable can invoke different functions at different times. Therefore, we wrap every function value in a reference object.

## Future extension

- lambda expression
``` python
def f(x: int) -> int:
    f1: Callable[[int], int] = None
    f2: Callable[[int], int] = None
    f1 = lambda a : a + 10
    f2 = f1
    return f1(x) + f2(x)
f(5)
```
The lambda expression is not supported yet. This is because the lambda expression is not typed, which disgrees with the chocopy's principle. Also we rely heavily on the typed expression for code generation. To support typed lambda expression, we need a new parser which support typed lambda expression. Unfortunately, `lezer-python` does not support that, and we have to implement it on our own. The rest part of the lambda expression should fit into our design well.

- nested class method
    ``` python
    class A:
        a:int = 0
        def f():
            x:int = 0
            def g():
                nonlocal x = x + 1
            return g
    ```
    Currently, we haven't taken the nested method in class into consideration. The vtable from inheritance is still on its way by the time we implement closures, and both features use the table, therefore the design must be compatible. We expect more works need to be done when flattening the nested method and generating codes. For example, the place to put the nested function in the table is nontrivial.

- ea optimization
    ``` python
    def f() -> int:
        x: int = 0
        def g() -> int:
            return 0
        return g()
    f()
    ```
    We assume every thing escaped as our starting point. This eases our implementation and guarantee the full functionality of closures. However, that adds a lot of overhead when wrapping every thing with a reference. In the above example, the `x` does not escape from `f` and no reference is needed. If time permits, we will work on the optimization.

- print function value
    ``` python
    def f() -> int:
        x: int = 0
        return 0
    print(f)
    ```
    Printing the function seems not much effort. The printing format in our mind is '<function name, function index in the table>'. We will add this future in the couple of few days.