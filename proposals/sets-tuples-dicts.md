# Project Proposal: Dictionaries

## 1. 10 Representative example programs related to our feature

By integrating the support from strings and lists, we seek to support dictionary snippets such as: 


**Example 1**: 
Initializes an empty dictionary dict_b and a dictionary dict_a with key-value pairs
```python
dict_b = {}
dict_a = {1:45, 2: 420, 3: 69}
``` 

**Example 2**: 
Initializes a dictionary dict_c using the dictionary passed to the dict() constructor
```python
dict_c = dict({1:45*56, 2: 2+89, 3:84-43})   # uses constructor
``` 

**Example 3**: 
Add additional key-value pairs in dict_b based on the input dict provided. For the same key, the value is updated.
```python
dict_b.update({5: 87})
``` 

**Example 4**: 
Overwrites the existing value for the corresponding key or updates a new key if the key is not already present 
```python
dict_a[3] = 1
``` 

**Example 5**: 
Accesses the key and gets the corresponding value. If we try to access a key that’s not present, it throws an error. 
```python
dict_a[7]               # KeyError since `7` is not a key
```

**Example 6**: 
Returns its respective value if the key is present and else, returns None.
```python
dict_a.get(7)  # returns `None` if key not present 
dict_a.get(2)  # returns 420
```

**Example 7**: 
Prints the dictionary.
```python
print(dict_a)
```

**Example 8**: 
Obtains the type of object. For a dictionary, it would always return “dict”
```python
print(type(dict_a))
```

**Example 9**: 
If the key is present, this method returns the value associated with the key and removes the key-value pair from the dictionary. Else, throws KeyError.
```python
dict_a.pop(2)
```

**Example 10**: 
clear(): This method clears all items in the dictionary and returns an empty dictionary
```python
dict_a.clear()
```

## 2. Tests
1. Parse expression tests to check parsing of empty dictionary initialization and dictionary with key-value pairs by both standard and constructor initialization.
2. Parse lookup-assign statement
3. Create tests to access the existence of keys, return KeyError if the key does not exist while accessing it.  Keys should be unique.
4. Tests to check the functionality of dictionary method calls: update, pop, clear, get. 
5. Printing a dictionary should return a list of correct key-value pairs. 
6. The type of dictionary should return the correct type.

## 3. New AST
1. Initialize a dictionary  
Example: {1: 10, 2: 22, 3:33}  
```javascript
Expr<A>: | {a?: A, tag: “dict”,  value: Map<Expr, Expr>}
```
2. Update the value in a dictionary given its key.  
Example: a[10] = 20
```javascript
Stmt<A>:  | {  a?: A, tag: "lookup-assign", name: string, key: Expr<A>, value: Expr<A> }
```
3. Lookup a value in a dictionary given its key.  
```javascript
Expr<A>: | {  a?: A, tag: "key-lookup", name: string, key: Expr<A>}
```
Note: the last 2 ASTs will be shared with the group that is working on lists and we have to coordinate with them  

## 4. New functions, data types, and/or files

No new functions, data types and or files are introduced in our implementation.

## 5. Changes to existing functions, data types, and/or files

Parser.ts:
- Add case to handle `DictionaryExpression` in `traverseExpr` in `parser.ts` and return an `expr` with `tag: "dict"`.
- When we need to retrieve the value of the particular key, we have to handle this look-up in `parser.ts` via the `tag: "key-lookup"`. This is used in the example `a = dict_a[4]`. 
- Add code to handle square braces `[]` in the `MemberExpression` case. It should return the `“lookup-assign”` tagged expression (Example is `dict_a[4] = 20`)

Compiler.ts:
- `GlobalEnv.classes` should have a builtin class `“dict”` with its members and offset.
- In the compile function, the builtin class dict methods - `dict$pop`, `dict$update`, `dict$get`, and `dict$clear` should be appended to the `allFuns` string.
- In `codeGenStmt()`, add case to generate wasm code for `“lookup-assign”`.
- In `codeGenExpr()`, add cases to generate wasm code for `“dict”` and `“key-lookup”`.
- In `codeGenExpr()`, under case `“builtin-1”`, add an if statement to check for print and argument type class and argument name ‘dict’. Then call `“print_dict”`.

Type-check.ts:
- In `tcStmt()`, add case to type-check `“lookup-assign”`
- In `tcExpr()`, add cases to type-check `“dict”` and `“key-lookup”`

Webstart.ts:
- Add a JS function `“print_dict”`: Retrieve all the key-value pairs from the hashtable and print them in the format `“{key_1: value_1, . . ., key_n:value_n}”`

Runner.ts:
- `run()` function: add code in `WasmSouce` to import the JS function `“print_dict”`


## 6. Value representation and memory layout

Representation of dictionary:

- We create a built-in “dict” class with pop(), clear(), update() and get() as member functions and pre-load into the compiler’s env.
- Each time a new dictionary is initialized in python, we will internally create an object of the “dict” class. 
- The class members are used to store the hash-map structure for the dict object. Say, our hash function creates ‘n’ buckets, then there will ‘n’ members in the class.
- Note: We don’t add the “dict” class explicitly to the python input code. We just assume as if this is provided every time in the input and we generate wasm accordingly.

Memory Layout:

- We are implementing the dictionary using the Hash table with linked list based collision resolution approach. Each time a dictionary object is created in python source code, we will assign memory for the hash table. The memory location of the dictionary object (say `d`), will store the starting address of the hash table.
- Based on the hash function, ‘n’ buckets will be created. For instance, if the hash function is mod 7, then we will create 7 buckets per dictionary object. Each bucket is initialized to `None`.
- Each bucket will be a pointer to a linked list. 
- Each item in the linked list is of the below form and occupies a minimum of 3 blocks of memory space. 
(key, value, address of next node in a linked list)
- When a new key is created, we will store the dictionary element in the next available memory location (say, ‘m’).  
Say, we perform `d[15] = 75`. Then we will store `(15, 75, NONE)`.
- Next, we have to update the linked list structure to point to this location. For this, we need to calculate the   hash value for the key. 
In the above example, the key is 15. The hash value for 15 is 15%7 = 1
- Once we know the hash value, then we go to the corresponding bucket. Since we know the starting address of the dictionary, we add the hash value to get the bucket.
- If the bucket has value `None`, then this is the first item in the linked list. We will then update `None` to ‘m’, that is, the location of the new key-value pair.
- If the bucket has some value, then we will have to go to that address and traverse the linked list till we find the last node of the linked list. We will then update the next address from None to ‘m’.
