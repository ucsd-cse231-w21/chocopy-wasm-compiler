
import { Config, defaultTypeEnv } from '../runner';
import { tc, tcStmt, tcExpr, TypeCheckError } from '../type-check';
import { expect } from 'chai';
import { NUM, BOOL, OBJ, NONE } from '../ast';
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
        fail("Expected an exception, got a type " + typ.tag);
      }
      catch(e) {
        expect(e).to.instanceof(TypeCheckError);
      }
    })  
  }

  assert("number", "1", NUM);
  assert("true", "True", BOOL);
  assert("false", "False", BOOL);

  assert("plus", "1 + 2", NUM);
  assertFail("plusBoolRight", "1 + True");
  assertFail("plusBoolLeft", "False + 2");
  assertFail("plusBoolBoth", "False + True");

  assert("mul", "1 * 2", NUM);
  assertFail("mulBoolRight", "1 * True");
  assertFail("mulBoolLeft", "False * 2");
  assertFail("mulBoolBoth", "False * True");

  assert("sub", "1 - 2", NUM);
  assertFail("subBoolRight", "1 - True");
  assertFail("subBoolLeft", "False - 2");
  assertFail("subBoolBoth", "False - True");

  assert("vars-then-plus", `
  x = 10
  y = 12
  x + y`, NUM);

  assert("vars-ending-in-defn", `
  x = 10
  y = 12
  y
  x = y + x`, NONE);

  assertFail("vars-ending-in-error", `
  x = True
  y = 12
  y + x`);

  assertFail("bad-assignment", `
  x = True
  y = 12
  y
  y = True`);
});
