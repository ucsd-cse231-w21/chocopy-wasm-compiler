import { PyBool, PyInt } from "../utils";
import { assert, asserts, assertPrint } from "./utils.test";

describe('inheritence', () => {
    assertPrint("constructor", `
class animal(object):
    number: int = 0
    def __init__(self:animal):
        self.number = 2
kit:animal = None
kit = animal()
print(kit.number)`, ["2"]);

    assertPrint("constructor-with-param",`
class animal(object):
    number: int = 1
    def __init__(self:animal, number:int):
        self.number = number
kit:animal = None
kit = animal(2)
print(kit.number)`, ["2"]);

    assertPrint("attributes-of-base-class",`
class animal(object):
    number: int = 1
        
class cat(animal):
    pass
        
kit:cat = None
kit = cat()
print(kit.number)`, ["1"]);

    assertPrint("attributes-of-derived-class",`
class animal(object):
    number: int = 1
        
class cat(animal):
    eatFish: bool = True
        
kit:cat = None
kit = cat()
print(kit.eatFish)`, ["True"]);


    assertPrint("methods-of-base-class",`
class animal(object):
    def run(self:animal):
        print(1)
        
class cat(animal):
    pass
        
kit:cat = None
kit = cat()
kit.run()`, ["1"]);

    assertPrint("methods-of-derived-class",`
class animal(object):
    pass
        
class cat(animal):
    def run(self:cat):
        print(1)
        
kit:cat = None
kit = cat()
kit.run()`, ["1"]);

    assertPrint("hierarchy-of-inheritance",`
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

});