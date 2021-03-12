# Milestone for Built-ins
The two chosen programs in our proposal works as expected. However, there's still a lot of work to be done in the regards of built-in libraries.

### Passing Arguments to Builtin Library Functions
By March 11, we're looking to support the passing of arguments to functions in builtin libraries. For example, in regards to our two chosen programs, we'd like to support programs like the following:

```
from otherModule import someFunc
someFunc(2, False, "helloWorld")

```

  

### Object Instantiation
By March 11, we're also looking to support the instantiation of classes defined in built-in libraries. For example, say in the built-in module `exampleModule`, there was a class called `IntWrapper` that simply stored an `int`.

  
  

We're looking to support the instantiation of `IntWrapper` as such:

```
from exampleModule import IntWrapper
x : IntWrapper = IntWrapper(10)
```

## Challenges

Navigating the current codebase of our language has been the biggest issue. There's still a significant amount of features that are still pending full implementation and given unsynchronized timelines of the project teams, its been difficult to fully account for all language features.

  

  

For example, if we are to fully support the passing of arguments to builtin libraries, that also includes object types - notably strings. Given how builtin libraries are implemented in our proposal, our team needs a defined way to encode and decode objects from the heap. But that requires coordination with the strings, lists/dicts, and memory teams.

  

# March 11 Submission Status

There's a separate section under after the __Examples__ section that details how built-in functions were implemented.

  

## Examples

### Working Examples:

  

1.) Calling of TypeScript functions execute as expected. The passing of string, integer, boolean and class (within our REPL code) instances work as expected.

```
from otherModule import otherFunc
otherFunc("hi", 20, False)
```

```
import otherModule as om
om.otherFunc("hi", 20, False) #Same output as above
```

2.) `print` , `max` , `min` , `abs` and `pow` have been translated to a built-in module called `natives` and so, invocation of any of these functions actually call a Typescript function that correlate to each respectively.

```
print("hello world")
```

We actually end up calling this function in TypeScript:

```
print(... args: number[]) : number{
	console.log(stringtify(this.allocator, args[0]));
	return args[0];
}

```

3.) Builtin functions can return primitives. We define primitives to be `string` , `int` and `bool` instances:

```
print(max(-20,10)) #this prints out 10
```

4.) Variables in builtin modules can be directly accessed and mutated by REPL programs.  Say the module `otherModule` has an exposed variable called `otherVar` that holds an `int` and initially holds the integer `20`. 
```
from otherModule import otherVar

otherVar = abs(otherVar) - abs(otherVar)  #otherVar should then be set to 0
print(otherVar) #This outputs 0
```
To confirm that the above code did indeed mutate `otherVar` in a way that's also visible to `otherModule`, if we call the function `printOtherVar()` - that prints the value of `otherVar` - housed in `otherModule` as such:
```
from otherModule import otherVar, printOtherVar

otherVar = abs(otherVar) - abs(otherVar)  #otherVar should then be set to 0
print(otherVar) #This outputs 0

printOtherVar()  
```
We can see that `0` is printed out, confirming that our mutation of `otherVar` is visible to both our REPL code and the TypeScript code that `otherModule` is written in.
  

### Not Working Examples

The following examples don't exhibit their expected behavior, mainly due to unimplemented/incomplete features. We'll also be featuring examples that **technically work**, but *aren't well designed to the point of confusion*.

  

1.) Builtin classes can't be properly instantiated in our REPL code. For example, say we have `IntWrapper` - as defined in our milestone - which is a builtin class housed in a builtin module called `wrappers`:

```

from wrappers import IntWrapper

x: IntWrapper = IntWrapper(10) #This throws a runtime error

```

__Required Extensions:__ For such mechanism to properly work, we'll need our compiler we'll need to hook a built-in class' constructors at runtime when object instantiation happens. With that, the constructor can be invoked to initialize the object.

  

2.) Passing of REPL class instances to builtin functions is _**possible**_ , but _very messy_ . Take the class `Student` as defined:

```
class Student(object):
	name: string = ""
	age: int = 0
```

And say we executed the following code:

```
from studentModule import ageChanger

x: Student = Student()

ageChanger(x, 21) #this changes the "age" attribute of x to 21
```

`ageChanger` does properly receive the instance held by `x` , but to access the attributes, it'll have to properly decipher the provided array: `[address to string instance, address to int instance]`.

The root of this problem is that this compiler doesn't have the information of class definitions at runtime to properly "wrap" instances for more convenient interaction. Builtin functions must instead use array indices and essentially _hope they know what their accessing/manipulating_.

  

__Required Extensions:__ Proper passing of class information from the "compilation" phase of our REPL to its runtime phase is needed to alleviate this issue. After doing so, custom objects can be wrapped into some mapping (attribute names as keys and addresses as values).

  

3.) Handling errors thrown by builtin functions isn't possible. For example, say we have the following code:

```
from angryModule import angryFunc

angryFunc("pls no error") #This function will throw an error if the given string doesn't
                          #match a random string it generated
```
Currently, our compiler doesn't have the syntactic (`try-catch` syntax wasn't implemented in time) and runtime mechanism to allow for error handling.


__Required Extension:__ Implementation of the `try-catch` syntax would be the first needed extension of our compiler. We'll also need to implement some sort of flag at runtime that signals whether an error thrown, but also the type of the error and origin (whether it was from our REPL code or a builtin module).

  

## Implementation Details
Before we proceed, when referring to modules, we call the code written in our REPL as the __source module__ and modules written in TypeScript (the ones that need importing) as __builtin modules__. A module in our compiler is either one - there's no in-between.

  

### Changes to Program Structure:

The `Program` type
```
export type Program<A> = {
	funcs: Map<string, FunDef<A>>;
	inits: Map<string, VarInit<A>>;
	classes: Map<string, Class<A>>;
	stmts: Array<Stmt<A>>;
	imports: Array<Stmt<A>>;
	presenter? : ModulePresenter;
};
```

Key takeaways:
* Functions are identified by their function signature, which follows the format `<name>(<parameterType>, ...)` . If two functions in the same module or in the same class are found to have the same signature, an error is thrown.
*  `import` statements are treated separately from top-level statements. `import` statements defined within classes, methods and functions are ignored. Only `import` statements defined outside those three components are considered. Lastly, `import` statements don't have to be the first statements, but they will be considered as if they were (essentially, they're "pushed up").

  

### Builtin Module Definition
Builtin modules - as defined - are basically collections of TypeScript code that can be invoked by a program executed by our REPL.

To define a builtin module, a TypeScript class must extend the `BuiltInModule` abstract class - in `builtins.ts` within the `builtins` directory:

```
export abstract class BuiltInModule {
	readonly name: string;
	readonly classes : Map<string, BuiltInClass>;
	readonly variables: Map<string, BuiltVariable>;
	readonly functions: Map<string, BuiltInFunction>;
	presenter: ModulePresenter;
	readonly allocator: MainAllocator;

	constructor(allocator: MainAllocator){
		this.allocator = allocator;
	}
};
```
For an example on how to properly extend this class, please look at the `Natives` class in `modules.ts`

Notes:
*  `BuiltInClass` is defined similarly.
*  `BuiltInVariable` is a wrapper around an `Instance` that allows builtin modules to readily mutate and retrieve values of their exposed global variables.
*  `BuiltInFunction` holds a reference to the actual TypeScript function to be invoked at runtime. This TypeScript function must have the following form: `funcName(... args: number[]) : number { } `


### Built-in Module Discovery
`module.ts` - in the `builtins` directory - has a function called `initializeBuiltins()` that returns two mappings of available builtin modules.

The first mapping is of module names and their `ModulePresenters`. The second if of module names and the actual modules themselves - represented as `BuiltInModule` instances.

If a developer wishes to include a new builtin module to be made available, they'd simply have to edit `initializeBuiltins()` and include their builtin module in the `modules` array within it.

### Changes to type checking

#### Module Presenters

```
export type ModulePresenter = {
	name: string,
	moduleVars: Map<string, Type>,
	functions: Map<string, FuncIdentity>,
	classes: Map<string, ClassPresenter> #defined similarly as ModulePresenter
}
```

A ModulePresenter purpose is to describe a module based solely on their type information:
* What are the types of the parameters a module function needs? How about their return types?
* What are the types of a module's variables?
* What is the type information of a module's classes?

During type checking, we can then pass the ModulePresenters of a builtin module to the typechecker, allowing for a seamless and neat way to check if our source module is correctly using builtin modules without touching any of the messy details regarding them.

At the end of type checking, the source module is also associated with its own ModulePresenter for future REPL entries.

  

### Changes to Value Representation
All values - `string`, `int` and `bool` values included - are heap allocated. This compiler has forgone tagged bits in its representation of values.

During runtime, when a value is allocated - be it a class instance or a primitive value - an `Instance` instance is created to represent that value during runtime.
```
export type Instance =
| {tag: "int", value: number}
| {tag: "bool", value: boolean}
| {tag: "string", value: string}
| {tag: "instance", moduleCode: number, typeCode: number, attrs: Array<number>}
```
And so, the heap is simply an array of `Instance`: `heap: Array<Instance>`

The 0th index of this array is purposely the value `undefined` to represent `None` values at runtime

When a value is passed to a builtin function, they actually receive the _index_ to the `Instance` representing that value on the heap. (_see 'Examples' above for why this is an issue_)