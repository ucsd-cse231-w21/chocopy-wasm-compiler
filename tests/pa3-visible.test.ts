import { PyInt, PyBool, PyNone, NUM, CLASS } from "../utils";
import { assert, asserts, assertPrint, assertTCFail, assertTC, assertFail } from "./utils.test";

describe("PA3 visible tests", () => {
  // 1
  assert("literal-int", `100`, PyInt(100));
    assertFail("literal-int", `a: int = None`);
    assert("alkdf", `class C:
    def something(self: C) -> int:
        return 100
        
a: C = C()
print(a.something())`, PyNone());
    assert("alkdf", `class C:
a: C = C()`, PyNone());

    assert("alkdf", `class C:
    def something(self: C) -> C:
        return None
        
a: C = C()
b: C = a.something()
print(100)`, PyNone());

    assertFail("none-to-fields", `
class C:
  a: int = None

`);
    
    assertFail("none-fields", `
class C:
  a: None = None

`);
    
    assertTC("class", `
class C:
  a: int = 100
C()
`, CLASS("C"));
    
    assertTC("class-2", `
class C:
  a: int = 100
class D:
  a: int = 100
C()
D()
`, CLASS("D"));

    assertTC("class-3", `
class C:
  a: int = 100

  def something(self: C) -> C:
    return self
C().something()
`, CLASS("C"));
    
    assertPrint("class-3-Print", `
class C:
  a: int = 100

  def something(self: C) -> C:
    print(1000)
    return self
C().something()
`, [`1000`]);
    
    assertFail("no-fields-for-none", `
class C:
  a: int = 100

  def something(self: C):
    print(1000)

var: C = None
var.something()
`);

    assert("chained-methods", `class Rat(object):
    n : int = 2
    d : int = 3
    def __init__(self : Rat):
        self.n = 200
    
    def something(self: Rat) -> Rat:
        return self
    def something2(self: Rat) -> Rat:
        return self
        
r1 : Rat = None
r1 = Rat()
print(r1.something().something2().n)
`, PyNone());

    assert('class-method-2', `class C(object):
    x : int = 123
    def getX(self: C) -> int:
      return self.x
    def setX(self: C, x: int):
      self.x = x`, PyNone());
});
