### A description of which examples will work by March 11, including any updates you want to make to the examples you plan for March 11 (it’s OK to scale back or up depending on where you got!)
All examples will work by March 11.

Implemented and working:  
- Static allocation of strings
- Concatenating two strings
- Printing strings
- Slicing strings (inlcuding advanced slicing operations)
- len function for strings
- String comparison
- Escape sequences

In-progress:  
- Loop iterators

### A description of the biggest challenge you faced in your week of implementation
1. Figuring out a way to allocate the temporary variables for iterators. 
2. Accessing and allocating wasm memory from TypeScript.


## Example programs that couldn't be implemented
### First
Formatting strings:
```python
print("%s %s" % ("Hello!", "World")
```

### Second
Assining new value to string iterators:

*Description*: Python supports assigning value to the iterator without
changing the underlying string. This currently prevented by typecheck
in my implementation.

```python
hello: str = "Hello"
iter: str = None

for iter in Hello:
	iter = "a"  # This changes the value of the iterator but not the string
	print(iter) # 'a'
	
print(hello)    # 'Hello'
```

### Third
Support for more escape sequences, e.g., `\r` for carriage return.

```python
print("Hello\rWorld") # World
```
