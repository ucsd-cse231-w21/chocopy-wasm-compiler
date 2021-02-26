# Proposal

Binlu Wang, Haoran Ye, Yiran Wu

repo: https://github.com/Freyr-Wings/pa1-ucsd-cse231-w21

## Q1-10 Representative Example Programs

### 1.  Specified Constructor

```python
class animal(object):
    number: int = 0
    def __init__(self:animal):
        self.number = 2
kit:animal = None
kit = animal()
print(kit.number)
```

The program is supposed to output 2 to represent it supports definition of specified constructor.

### 2.  Constructor with parameters

```python
class animal(object):
    number: int = 1
    def __init__(self:animal, number:int):
        self.number = number
kit:animal = None
kit = animal(2)
print(kit.number)
```

The program is supposed to output 2 to represent it supports parameters of constructor.

### 3.  Attributes of Base Class

```python
class animal(object):
    number: int = 1
        
class cat(animal):
    pass
        
kit:cat = None
kit = cat()
print(kit.number)
```

The program is supposed to output 1 to represent it supports definition of attributes of base class.

### 4.  Attributes of Derived Class

```python
class animal(object):
    number: int = 1
        
class cat(animal):
    eatFish: bool = True
        
kit:cat = None
kit = cat()
print(kit.eatFish)
```

The program is supposed to output True to represent it supports definition of attributes of derived class.

### 5.  Methods of Base Class

```python
class animal(object):
    def run(self:animal):
        print(1)
        
class cat(animal):
    pass
        
kit:cat = None
kit = cat()
kit.run()
```

The program is supposed to output 1 to represent it supports definition of methods of base class.

### 6.  Methods of Derived Class

```python
class animal(object):
    pass
        
class cat(animal):
    def run(self:cat):
        print(1)
        
kit:cat = None
kit = cat()
kit.run()
```

The program is supposed to output 1 to represent it supports definition of methods of derived class.

### 7.  Hierarchy of Inheritance

```python
class animal(object):
    number:int = 1
class mammal(animal):
    leg:int = 4
class cat(mammal):
    def run(self:cat):
        print(self.number+self.leg)
        
kit:cat = None
kit = cat()
kit.run()
```

The program is supposed to output 1 to represent it supports inheritance of a derived class.

### 8.  Re-defined Methods

```python
class animal(object):
    def run(self:animal):
        print(1)
        
class cat(animal):
    def run(self:cat):
        print(2)
        
kit:cat = None
kit = cat()
kit.run()
```

The program is supposed to output 2 to represent it supports re-definition of methods in derived class.

### 9.  Polymorphism

```python
class animal(object):
    def run(self:animal):
        print(1)
        
class cat(animal):
    pass
def f(pet:animal):
    pet.run()

kit:cat = None
kit = cat()
f(kit)
```

The program is supposed to output 1 to represent it supports assigning a derived class to its base class.

### 10.  Polymorphism

```python
class animal(object):
    def run(self:animal):
        pass
        
class cat(animal):
    def run(self:cat):
        print(2)
class dog(animal):
    def run(self:dog):
        print(1)
def f(pet:animal):
    pet.run()

bob:dog = None
kit:cat = None
bob = dog()
kit = cat()
f(kit)
f(bob)
```

The program is supposed to output 2\n1 to represent it supports polymorphism.

## Q2-A description of how you will add tests for your feature

Firstly, we add some basic tests to certify our program correctly supports attributes and methods in both base and derived classes. We can compare the output and memory space with expected answer to check if our program works properly. 

Secondly, we add some tests to demonstrate our program is able to handle some advanced functions such as specified constructors, polymorphism. We still check the memory space to guarantee correctness. 

## Q3-A description of any new AST forms you plan to add

We don't need to add any new AST. But we need to make some change to the properties of current AST.

## Q4-A description of any new functions, datatypes, and/or files added to the codebase

```typescript
class ClassType {
  globalName: string;
  methods: Map<string, FuncType>;
  methodPtrs: Map<string, number>;
  methodPtrsHead: number;
  attributes: Map<string, Variable>;
  parent: ClassType;
  size: number;
  tag: number;
}
```

We need to add ClassType that can record its parent type, the offsets of its methods and the offset of its dispatch table. 

## Q5-A description of any changes to existing functions, datatypes, and/or files in the codebase

For each function, we need a global function map that can record the index of each function in the wasm table. Besides, we plan to support both global functions and class methods, so we will specially separate the logic for function definition, function call and method definition and method call.

## Q6-A description of the value representation and memory layout for any new runtime values you will add

Here we follows the same object layout as ChocoPy. Therefore, each object is actually a pointer to the real object, except for the basic types like int and bool.

```
Object layout
31                              0
+--------------------------------+
|            type tag            |
+--------------------------------+
|          size in words         |
+--------------------------------+
|    pointer to dispatch table   |
+--------------------------------+
|           Attribute 1          |
+--------------------------------+
|           Attribute 2          |
+--------------------------------+
|               ...              |
+--------------------------------+
```

The dispatch table will record all the method pointers within the class.

```
Dispatch table
31                              0
+--------------------------------+
|       pointer to method 1      |
+--------------------------------+
|       pointer to method 2      |
+--------------------------------+
|               ...              |
+--------------------------------+
```



## Q7-A milestone plan for March 4 

By March 4, we hope we have accomplished the basic parts necessary to function inheritance and our program is supposed to work properly on example 3,4,5,6.
