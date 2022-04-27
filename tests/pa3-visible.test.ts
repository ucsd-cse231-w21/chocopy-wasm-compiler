import { assertPrint, assertFail, assertTCFail, assertTC } from "./asserts.test";
import { NUM, BOOL, NONE, CLASS } from "./helpers.test"

describe("PA3 visible tests", () => {
  // 1
  assertPrint("literal-int-ops", `print(100 + 20 + 3)`, [`123`]);
  // 2
  assertPrint("literal-bool", `print(True)`, [`True`]);
  // 3
  assertPrint(
    "print-int-print-bool",
    `
print(0)
print(False)`,
    ["0", "False"]
  );
  // 4
  assertPrint("basic-global", `
x : int = 0
x = -1 * -1
print(x)`, [`1`]);
  // 5
  assertPrint("basic-if", `
x : int = 0
if True:
  x = 5
else:
  x = 3
print(x)` , [`5`]);
  // 6
  assertPrint(
    "basic-class-lookup",
    `
class C(object):
  x : int = 123

c : C = None
c = C()
print(c.x) `,
    [`123`]
  );
  // 7
  assertPrint(
    "basic-class-field-assign",
    `
class C(object):
  x : int = 123
  
c : C = None
c = C()
c.x = 42
print(c.x)`,
    [`42`]
  );
  // 8
  assertPrint("basic-class-method",
`
class C(object):
  x : int = 123
  def getX(self: C) -> int:
    return self.x
  def setX(self: C, x: int):
    self.x = x

c : C = None
c = C()
print(c.getX())
c.setX(42)
print(c.getX())`, [`123`, `42`]);
  // 9
  assertPrint("multi-class", 
`
class C(object):
  x : int = 1
  y : int = 2

class D(object):
  y : int = 3
  x : int = 4
c : C = None
d : D = None
c = C()
d = D()
print(c.x)
print(d.x)`, [`1`, `4`]);
  // 10
  assertPrint("alias-obj",
`
class C(object):
  x : int = 1

c1 : C = None
c2 : C = None

c1 = C()
c2 = c1
c1.x = 123
print(c2.x)
`, [`123`]),
  // 11
  assertPrint("chained-method-calls", `
class C(object):
  x : int = 123
  def new(self: C, x: int) -> C:
    print(self.x)
    self.x = x
    print(self.x)
    return self
  def clear(self: C) -> C:
    return self.new(123)

C().new(42).clear()`, ["123", "42", "42", "123"])
  // 12
  assertFail("no-fields-for-none", `
class C(object):
  x : int = 0
  
c : C = None
c.x`);
  // 13
  assertPrint("constructor-non-none", `
class C(object):
  x : int = 0
print(not (C() is None))`, [`True`]);
  // 14
  assertTC("non-literal-condition", `
x : int = 1
y : int = 2
if x < y:
  pass
else:
  x = -x
x`, NUM);
  // 15
  assertTC("tc-two-classes", `
class C(object):
  d : D = None
  
class D(object):
  c : C = None
c : C = None
c.d
  `, CLASS("D"));
  // 16
  assertTC("tc-two-classes-methods", `
class C(object):
  d : D = None
  def new(self: C, d : D) -> C:
    self.d = d
    return self
    
class D(object):
  c : C = None
  def new(self: D, c: C) -> D:
    self.c = c
    return self
    
c : C = None
d : D = None
c = C().new(d)
c.d.c`, CLASS("C"));
  // 17
  assertTC("none-assignable-to-object", `
class C(object):
  x : int = 1
  def clear(self: C) -> C:
    return None

c : C = None
c = C().clear()
c`, CLASS("C"));
  // 18
  assertTC("constructor-type", `
class C(object):
  x : int = 0
  
C()`, CLASS("C"));
  // 19
  assertTCFail("tc-literal", `
x : int = None`);
// 20
assertTC("assign-none", `
class C(object):
  x : int = 0
c : C = None
c = None`, NONE);
});
