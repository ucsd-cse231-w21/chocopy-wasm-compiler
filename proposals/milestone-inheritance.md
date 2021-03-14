# Milestone

Binlu Wang, Haoran Ye, Yiran Wu

## Stage1

Our compiler pass the tests 1-7 in our proposal. The test script is `/test/inheritence.test.ts`.

## Stage2-examples for March 11

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

## Challenge

Our project use memory as the calling stack, and in order to further support polymorphism, we need to use function pointer and dispatch table. Therefore, we need to modify the steps of our function / method call. 

The rearrangement of functions and objects took us a lot of time. And finally we generalize the function call to a function pointer in function table. Every time when we call a method, constructor or function, we first need to find the location of this function pointer, then load this pointer and call it. 



## Final Stage

Our compiler can support single inheritance and all the examples mentioned in the proposal. Below are the new features to be implemented in the future.

### New Features for Future

```python
# multiple inheritance
class A(object):
    x:int = 1
class B(object):
    y:int = 2
class C(A, B):
    z:int = 3

c:C = None
c = C()
print(c.x)
```

```python
# C3 MRO(method resolution order)
class Base(object):
    def show():
        print(0)
class A(Base):
    pass
class B(object):
    def show():
        print(2)
class C(A, B):
    pass

C().show()  # expect 2
```

```python
# C3 MRO with super
class Base(object):
	def work(self):
		print(1)
class A(Base):
	def work(self):
		super().work()
		print(3)
class B(Base):
	def work(self):
		super().work()
		print(2)
class C(A,B):
	def work(self):
		super().work()
		print(4)

C().work()  # expected output is "1\n2\n3\n4"
```







