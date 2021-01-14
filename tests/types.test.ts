
import { Config, defaultTypeEnv } from '../runner';
import { tc, tcStmt, tcExpr } from '../type-check';
import { expect } from 'chai';
import { NUM, BOOL, OBJ, NONE } from '../ast';
import { emptyEnv } from '../compiler';
import 'mocha';
import { parse } from '../parser';

describe('tc', () => {
  function assert(name: string, source: string, result: any) {
    it(name, async() => {
      const ast = parse(source);
      const [typ, _] = tc(defaultTypeEnv, ast);
      expect(typ).to.equal(result);
    })  
  }

  assert("number", "1", NUM);
  assert("true", "True", BOOL);
  assert("false", "False", BOOL);
});
