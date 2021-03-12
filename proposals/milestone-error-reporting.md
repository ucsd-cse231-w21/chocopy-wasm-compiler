### Code and tests demonstrating that the 2 programs you chose from your proposal are working as expected
![image of attribute error](https://i.ibb.co/8gyvfWy/Attribute-Error.png)
![image of Name Error](https://i.ibb.co/P45RK3M/2021-03-03-6-55-50.png)


### A description of which examples will work by March 11, including any updates you want to make to the examples you plan for March 11 (it’s OK to scale back or up depending on where you got!)
By March 4, we have finished static error throwing that existed in type-check.ts, compiler.ts and parser.ts. By March 11, we are going to have runtime errors (dynamic errors). For example, 
```python
x:int = 0
7 // x
```
It will throw a ZeroDivisionError at runtime.
Another example is 
```python
x:int = -1
items: [int] = None
items = [0]
items[x]
```
It will throw an IndexError at runtime.

We are also going to cooperate with the front-end team to see if we need to provide more info from the error classes to have better error messages.



### A description of the biggest challenge you faced in your week of implementation
Right now, the stacktrace of errors only shows that the error is from webstart.js. We want the stacktrace to show the trace of the calling stack of the python code from the user, instead of the webstart.js. We are still figuring out how to implement this.  
