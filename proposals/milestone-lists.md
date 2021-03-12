# CSE231 Milestone-Lists 
Erika Auyeung, Chao Chi Cheng

### 1. Code and tests demonstrating that the 2 programs you chose from your proposal are working as expected

#### Program 2:
```python
items : [int] = None
items = [1, 2, 3]
```

![](https://i.imgur.com/i9S2fFi.png)


#### Program 4:
```python
items : [int] = None
n : int = 10
items = [1, 2]
n = items[0] + items[1]
```

![](https://i.imgur.com/9UPlFXJ.png)


### 2. A description of which examples will work by March 11, including any updates you want to make to the examples you plan for March 11

#### Program 1
We are scaling back our Program 1 because inheritance may be too much to handle in the time we have left.
```python
class A(object):     
    a : int = 0
class B(object):    
    b : int = 0
x : [A] = None
y : [B] = None
z : [object] = None
x  = [A(), A()]
y  = [B(), B()]
z = x + y
```
Our new version of Program 1 is as follows. We have changed our focus to be on the list functions in Python.
```python
x : [int] = None
y : [int] = None
x = [1,2,3]
y = x.copy()
x.clear()
x.append(4)
```

#### Program 3
```python
items : [int] = None
items = [1, 2, 3] + [4, 5, 6]
```

#### Program 5
```python
items : [int] = None
items = [1, 2, 3] 
items[1] = 90
```
#### Program 6 &#8594; Runtime error (Index out of bounds, error code 3)
```python
items : [int] = None
items = [1, 2, 3, 4, 5, 6]
items[10] = 90
```
It will be handled by the error reporting team. We have provided them with the infrastructure and code for this, so they should have it in their pull request.

#### Program 7 &#8594; Runtime error (Operation on None, error code 4)
```python
items : [int] = None
items[0] = 11
```
It will be handled by the error reporting team.

#### Program 8
```python
items : [int] = None
items = [1, 2, 3]
print(items)
```
We have updated this program to no longer be a runtime error.
This should print the details of the list like:
```
<list<int> at address 12> [1, 2, 3]
```
The address will vary.

#### Program 10
```python
items : [int] = None
items = [1, 2, 3]
print(items[2])
print(len(items))
```
#### Program 11 &#8594; Compile time error (type error)
```python
class A(object):     
    a:int= 0      
class B(A):    
    b:int= 0      
x : [A] = None
x  = [B(), B()]
```

### 3. A description of the biggest challenge you faced in your week of implementation
```python
class A(object):
  n:int = 0
x : [A] = None
x = [A(), A(), A(), A()]
print(x[0].n)
print(x[1].n)
print(x[2].n)
print(x[3].n)
```
The list creation that involves class construction is one of the biggest challenges we have during our implementation. As both list creation and class construction increment the heap head pointer, each class construction would increment the location used to store the new list element, i.e. itself. This also meant that the stored memory address of the list would be wrong.
Our solution is constructing all the class instances before list creation, then creating the list from the value remaining in the stack. This means that the class constructions don't affect the heap pointer in the middle of list creation.

## Extensions to our program

### 1.
One possible extension we would want to make is to allow for lists of objects with common ancestors.
```python
class A(object):     
    a : int = 0
class B(object):    
    b : int = 0
x : [A] = None
y : [B] = None
z : [object] = None
x  = [A(), A()]
y  = [B(), B()]
z = x + y
```

### 2. [List Change](https://www.w3schools.com/python/python_lists_change.asp)
The other extension we like to do is replace a chunk of list with another list of elements. This can replace the chunk with fewer elements, an equal number, or more elements; as a result the list size can change.

```python
x : [int] = None
x = [1,2,3]
x[1:2] = [4]
print(x)
```
The result should be something like:
```
<list<int> at address 12> [ 1, 4 ]
```

### 3. `list()` constructor
The last extension we would like to do is the `list()` constructor, which allows us to transform sequences of data, such as tuples, into lists.

```python
tup : (int, int) = (5, 79)
items : [int] = None
items = list(tup)
print(items)
```
The result should be like:
```
<list<int> at address 12> [ 5, 79 ]
```