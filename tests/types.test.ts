
import { Config, defaultTypeEnv } from '../runner';
import { tc, tcStmt, tcExpr, TypeCheckError } from '../type-check';
import { expect } from 'chai';
import { Type } from '../ast';
import { emptyEnv } from '../compiler';
import 'mocha';
import { parse } from '../parser';
import { fail } from 'assert';

describe('tc', () => {
  function assert(name: string, source: string, result: any) {
    it(name, async() => {
      const ast = parse(source);
      const [typ, _] = tc(defaultTypeEnv, ast);
      expect(typ).to.equal(result);
    })  
  }
  function assertFail(name: string, source: string) {
    it(name, async() => {
      const ast = parse(source);
      try {
        const [typ, _] = tc(defaultTypeEnv, ast);
        fail("Expected an exception, got a type " + typ);
      }
      catch(e) {
        expect(e).to.instanceof(TypeCheckError);
      }
    })  
  }

  assert("number", "1", Type.NUM);
  assert("true", "True", Type.BOOL);
  assert("false", "False", Type.BOOL);

  assert("plus", "1 + 2", Type.NUM);
  assertFail("plusBoolRight", "1 + True");
  assertFail("plusBoolLeft", "False + 2");
  assertFail("plusBoolBoth", "False + True");

  assert("mul", "1 * 2", Type.NUM);
  assertFail("mulBoolRight", "1 * True");
  assertFail("mulBoolLeft", "False * 2");
  assertFail("mulBoolBoth", "False * True");

  assert("sub", "1 - 2", Type.NUM);
  assertFail("subBoolRight", "1 - True");
  assertFail("subBoolLeft", "False - 2");
  assertFail("subBoolBoth", "False - True");

  assert("vars-then-plus", `
  x : int = 10
  y : int = 12
  x + y`, Type.NUM);

  assert("vars-ending-in-defn", `
  x : int = 10
  y : int = 12
  y
  x = y + x`, Type.NONE);

  assert("recursive-fun-tc", `
  def fib(n : int) -> int:
    if n < 2:
      return 1
    else:
      return n * fib(n - 1)

  fib(5)`, Type.NUM);

  assert("mutual-recursive-fun-tc", `
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

  is_even(100)`, Type.BOOL);

  assertFail("vars-ending-in-error", `
  x : bool = True
  y : int = 12
  y + x`);

  assertFail("bad-assignment", `
  x : bool = True
  y : int = 12
  y
  y = True`);
});
