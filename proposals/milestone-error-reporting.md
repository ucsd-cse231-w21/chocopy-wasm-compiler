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


## March 11

### In your milestone file, add a new section at the end indicating three example programs or scenarios that would require extensions to your design that you can imagine making, but didn't have the time for.


1. Currently we label code in each repl with a file number of auto-increasing integer, i.e. the first repl’s code is file 1, the second repl’s code is file 2. Front end website has a button called `load`, it will load the file in the given directory and put it in repl. Currently, we just assign a number label for the loaded code but instead it would be more intuitive to assign that label with the file name so that we could handle more complicated code management later when there are many loaded files. 



2. Credit to Winston: In the tesing folder, we can write a function to remove the annotation of parser. Therefore, each team won't need to change a lot of code for testing parsing after we slightly change the annotation type in parser.ts rach time.



3. Right now __checkIndex(size: number, key: number) in errorManager.ts will only check and throw IndexError for the list team. They require the index to be in [0, size). This function is able to be used by the String team but I haven’t got a reply from them. I can see in their code that they use if-statement to check the index by themselves. I think if time allowed, we can extend our __checkIndex(size: number, key: number) for them to use. They may allow negative indexes. 
