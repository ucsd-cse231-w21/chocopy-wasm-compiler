import { PyBool, PyInt } from "../utils";
import { assert, asserts, assertPrint, assertTCFail, assertTC, assertFail } from "./utils.test";

describe('inheritence', () => {
  assertPrint("constructor", `
class animal(object):
  number: int = 0
  def __init__(self:animal):
    self.number = 2
kit:animal = None
kit = animal()
print(kit.number)`, ["2"]);

  assertPrint("constructor-with-param", `
class animal(object):
  number: int = 1
  def __init__(self:animal, number:int):
    self.number = number
kit:animal = None
kit = animal(2)
print(kit.number)`, ["2"]);

  assertPrint("attributes-of-base-class", `
class animal(object):
  number: int = 1
        
class cat(animal):
  pass
        
kit:cat = None
kit = cat()
print(kit.number)`, ["1"]);

  assertPrint("attributes-of-derived-class", `
class animal(object):
  number: int = 1
        
class cat(animal):
  eatFish: bool = True
        
kit:cat = None
kit = cat()
print(kit.eatFish)`, ["True"]);


  assertPrint("methods-of-base-class", `
class animal(object):
  def run(self:animal):
    print(1)
        
class cat(animal):
    pass
        
kit:cat = None
kit = cat()
kit.run()`, ["1"]);

  assertPrint("methods-of-derived-class", `
class animal(object):
  pass
        
class cat(animal):
  def run(self:cat):
    print(1)
        
kit:cat = None
kit = cat()
kit.run()`, ["1"]);

  assertPrint("hierarchy-of-inheritance", `
class animal(object):
  number:int = 1
class mammal(animal):
  leg:int = 4
class cat(mammal):
  def run(self:cat):
    print(self.number+self.leg)
        
kit:cat = None
kit = cat()
kit.run()`, ["5"]);

  assertPrint("re-defined-methods", `
class animal(object):
  def run(self:animal):
    print(1)
        
class cat(animal):
  def run(self:cat):
    print(2)
        
kit:cat = None
kit = cat()
kit.run()`, ["2"]);

  assertPrint("polymorphism1", `
class animal(object):
  def run(self:animal):
    print(1)
        
class cat(animal):
  pass
def f(pet:animal):
  pet.run()

kit:cat = None
kit = cat()
f(kit)`, ["1"]);

  assertPrint("polymorphism2", `
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
f(bob)`, ["2", "1"]);

  assertPrint("extra1", `
class cls1(object):
  x:int=1
  def __init__(c:cls1, x:int):
    c.x=x*x
  def run(c:cls1):
    print(c.x)

class cls2(object):
  x:cls1=None
  def m(c:cls2):
    c.x.run()

a:cls1=None
b:cls2=None
a=cls1(21)
b=cls2()
b.x=a
b.m()`, ["441"]);

  assertPrint("extra2", `
x:int=1
def func1():
  y:int=2
  def func2():
    z:int=3
    print(x+y+z)
  func2()
func1()`, ["6"])

  assert("resolve-issue", `
class blah(object):
  x: int = 123

def test() -> blah:
  if True:
    return blah()
  else:
    return blah()
test().x`, PyInt(123));

  assert("resolve-issue", `
def test() -> bool:
  if True:
    return True
    8
  else:
    return False
test()`, PyBool(true));
  assert("inheritance init", `
class A(object):
  x:int = 10
  def __init__(self:A):
    self.x = 12

class B(A):
  pass

a:B = None
a = B()
a.x
`
    , PyInt(12))
  assert("more init", `
class A(object):
  x:int = 10
  def __init__(self:A):
    self.x = 12

class B(A):
  def __init__(self:B):
    self.x = 13

a:B = None
a = B()
a.x
`, PyInt(13))

  assert("recursion", `
class n(object):
  x: int = 10
  a: int = 0
  b: int = 1
  c: int = 0
class fib(n):
  def calfib(self:fib):
    if (self.x > 0):
      self.x = self.x - 1
      self.c = self.a + self.b
      self.a = self.b
      self.b = self.c
      self.calfib()

ans:fib = None
ans = fib()
ans.calfib()
ans.b`, PyInt(89));
  assert("polymorphism with recursion", `
class n(object):
  x: int = 10
  def calc(self:n):
    pass
class fib(n):
  a: int = 0
  b: int = 1
  c: int = 0
  def calc(self:fib):
    tmp: int = 0
    tmp = self.x
    if (self.x > 0):
      self.x = self.x - 1
      self.c = self.a + self.b
      self.a = self.b
      self.b = self.c
      self.calc()
    self.x = tmp
class exp2(n):
  b: int = 1
  def calc(self:exp2):
    tmp: int = 0
    tmp = self.x
    if (self.x > 0):
      self.b = self.b + self.b
      self.x = self.x - 1
      self.calc()
    self.x = tmp
def calc(ans:n):
  ans.calc()
ans1:fib = None
ans2:exp2 = None
ans1 = fib()
calc(ans1)
ans2 = exp2()
calc(ans2)
ans1.b+ans2.b`, PyInt(1113));
  assert("initialization", `
class n(object):
  x: int = 10
  def __init__(self:n, i:int):
    self.x = i
  def calc(self:n):
    pass
class fib(n):
  a: int = 0
  b: int = 1
  c: int = 0
  def calc(self:fib):
    tmp: int = 0
    tmp = self.x
    if (self.x > 0):
      self.x = self.x - 1
      self.c = self.a + self.b
      self.a = self.b
      self.b = self.c
      self.calc()
    self.x = tmp
class exp2(n):
  b: int = 1
  def calc(self:exp2):
    tmp: int = 0
    tmp = self.x
    if (self.x > 0):
      self.b = self.b + self.b
      self.x = self.x - 1
      self.calc()
    self.x = tmp
def calc(ans:n):
  ans.calc()
ans1:fib = None
ans2:exp2 = None
ans1 = fib(3)
calc(ans1)
ans2 = exp2(5)
calc(ans2)
ans1.b+ans2.b`, PyInt(35));
  assert("while", `
a:int = 10
s:int = 0
while a > 0:
  s = s + a
  a = a - 1
s`, PyInt(55));

  assertPrint("mutual recursion", `
class n(object):
  x:int = 10
  y:int = 10
  def __init__(self:n, i:int, j:int):
    self.x = i
    self.y = j

class ack(n):
  def work(self:ack)->int:
    tmp:ack2 = None
    tmp2:ack2 = None
    k:int = 0
    if(self.x == 0):
        return self.y + 1
    if(self.y == 0):
        tmp = ack2(self.x - 1, 1)
        return tmp.work()
    tmp2 = ack2(self.x, self.y - 1)
    tmp = ack2(0, 0)
    tmp.x = self.x - 1
    tmp.y = tmp2.work()     
    return tmp.work()

class ack2(n):
  def work(self:ack2)->int:
    tmp:ack = None
    tmp = ack(0,0)
    while self.x > 0:
      if self.y == 0:
        self.x = self.x - 1
        self.y = 1
      else:
        tmp.x = self.x 
        tmp.y = self.y - 1
        self.x = self.x - 1
        self.y = tmp.work()
    return self.y + 1
a:ack = None
b:ack2 = None
a = ack(2, 2)
b = ack2(2, 2)
print(a.work() == b.work())`, ["True"])
  assertTCFail("wrong base name", `
class C(object):
  x:int = 0
class D(c):
  x:bool = False
d:D = None
d = D()`);
  assertTCFail("wrong attr type", `
class C(object):
  x:int = 0
class D(C):
  x:bool = False
d:D = None
d = D()
D().x+1`);
  assertTCFail("wrong method type", `
class C(object):
  x:int = 0
  def work(self:C)->int:
    return self.x
class D(C):
  x:bool = False
  def work(self:D)->bool:
    return self.x
d:D = None
d = D()
d.work()+1
  `);
});
