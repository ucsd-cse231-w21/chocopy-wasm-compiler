import { assertTC, assertTCFail } from "./utils.test";
import { NUM, BOOL, NONE } from "../utils";

describe("tc", () => {
  assertTC("number", "1", NUM);
  assertTC("big number", "4294967296", NUM);
  assertTC("true", "True", BOOL);
  assertTC("false", "False", BOOL);

  assertTC("plus", "1 + 2", NUM);
  assertTCFail("plusBoolRight", "1 + True");
  assertTCFail("plusBoolLeft", "False + 2");
  assertTCFail("plusBoolBoth", "False + True");

  assertTC("mul", "1 * 2", NUM);
  assertTCFail("mulBoolRight", "1 * True");
  assertTCFail("mulBoolLeft", "False * 2");
  assertTCFail("mulBoolBoth", "False * True");

  assertTC("sub", "1 - 2", NUM);
  assertTCFail("subBoolRight", "1 - True");
  assertTCFail("subBoolLeft", "False - 2");
  assertTCFail("subBoolBoth", "False - True");

  assertTC(
    "vars-then-plus",
    `
  x : int = 10
  y : int = 12
  x + y`,
    NUM
  );

  assertTC(
    "vars-ending-in-defn",
    `
  x : int = 10
  y : int = 12
  y
  x = y + x`,
    NONE
  );

  assertTC(
    "recursive-fun-tc",
    `
  def fib(n : int) -> int:
    if n < 2:
      return 1
    else:
      return n * fib(n - 1)

  fib(5)`,
    NUM
  );

  assertTC(
    "mutual-recursive-fun-tc",
    `
  def is_even(n : int) -> bool:
    if n == 0:
      return True
    else:
      return is_odd(n - 1)

  def is_odd(n : int) -> bool:
    if n == 1:
      return True
    else:
      return is_even(n - 1)

  is_even(100)`,
    BOOL
  );

  assertTCFail(
    "vars-ending-in-error",
    `
  x : bool = True
  y : int = 12
  y + x`
  );

  assertTCFail(
    "bad-assignment",
    `
  x : bool = True
  y : int = 12
  y
  y = True`
  );

  assertTC(
    "class-with-field",
    `
  class C(object):
    x : int = 1

  c1 : C = None
  c1 = C()
  c1.x`,
    NUM
  );

  assertTC(
    "class-with-field-assign",
    `
  class C(object):
    x : int = 1
    y : int = 2
  c1 : C = None
  c1 = C()
  c1.x = c1.y`,
    NONE
  );

  assertTC(
    "class-with-method",
    `
  class C(object):
    x : int = 1
    y : int = 2

    def new(self : C, x : int, y : int) -> C:
      self.x = x
      self.y = y
      return self

  c : C = None
  c = C().new(3, 4)
  c.x`,
    NUM
  );

  assertTCFail(
    "dict-bad-assignment",
    `
  d : [int,int] = None
  d = {1:False, 2:True}`
  );

  assertTCFail(
    "dict-bad-assignment",
    `
    a:[int, [int, int]] = None
    a = {2:True}`
  );

  assertTCFail(
    "dict-bad-assignment",
    `
    a:[int, [int, int]] = None
    a = {2:{3:True}}`
  );

  assertTCFail(
    "dict-incomplete-assignment",
    `
  d: [int, int] = None
  d = {4}`
  );

  assertTCFail(
    "dict-bad-lookup",
    `
  d: [int, int] = None
  d = {4:5, 1:4}
  d[True]`
  );

  assertTCFail(
    "dict-bad-assign",
    `
  a:[int,int]=None
  a = {}
  a[8] = True`
  );

  assertTCFail(
    "dict-bad-constructor-init",
    `
  a:[int,int]=None
  a = dict(1)`
  );

  assertTCFail(
    "dict-bad-method-call-pop",
    `
  dict_a:[int, int] = None
  dict_a = {5:4, 4:7}
  dict_a.pop(6)`
  );

  assertTCFail(
    "dict-bad-method-call-pop",
    `
  dict_a:[int, int] = None
  dict_a = {5:4, 4:7}
  dict_a.pop(True)`
  );

  assertTCFail(
    "dict-bad-method-call-pop",
    `
  dict_a:[int, int] = None
  dict_a = {5:4, 4:7}
  dict_a.pop(7,8,9)`
  );

  assertTCFail(
    "dict-bad-method-call-get",
    `
  dict_a:[int, int] = None
  dict_a = {5:4, 4:7}
  dict_a.get(7,8,9)`
  );

  assertTCFail(
    "dict-bad-method-call-get",
    `
  dict_a:[int, int] = None
  dict_a = {5:4, 4:7}
  dict_a.get(7)`
  );

  assertTCFail(
    "dict-bad-method-call-get",
    `
  dict_a:[int, int] = None
  dict_a = {5:4, 4:7}
  dict_a.get(False)`
  );

  assertTCFail(
    "dict-bad-method-call-clear",
    `
  dict_a:[int, int] = None
  dict_a = {5:4, 4:7}
  dict_a.clear(5)`
  );

  assertTCFail(
    "dict-bad-method-call-update",
    `
  dict_a:[int, int] = None
  dict_a = {5:4, 4:7}
  dict_a.update(4)`
  );

  assertTCFail(
    "dict-bad-method-call-update",
    `
  dict_a:[int, int] = None
  dict_a = {5:4, 4:7}
  dict_a.update(9,4)`
  );

  assertTCFail(
    "dict-bad-method-call-update",
    `
  dict_a:[int, int] = None
  dict_a = {5:4, 4:7}
  dict_a.update(True)`
  );

  assertTCFail(
    "dict-bad-method-call-update",
    `
  dict_a:[int, int] = None
  dict_a = {5:4, 4:7}
  dict_a.update([9,4])`
  );
});
