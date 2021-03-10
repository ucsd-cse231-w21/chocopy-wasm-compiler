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