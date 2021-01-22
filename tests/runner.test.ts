import { Config, defaultTypeEnv, run, runWat } from '../runner';
import { expect } from 'chai';
import { emptyEnv } from '../compiler';
import 'mocha';

const importObject = {
  imports: {
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
    print: (arg : any) => {
      importObject.output += arg;
      importObject.output += "\n";
      return arg;
    },
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    pow: Math.pow
  },

  output: ""
};

// Clear the output before every test
beforeEach(function () {
  importObject.output = "";
});
  
// We write end-to-end tests here to make sure the compiler works as expected.
// You should write enough end-to-end tests until you are confident the compiler
// runs as expected. 
describe('run', () => {
  const config : Config = { importObject, env: emptyEnv, typeEnv: defaultTypeEnv };

  function assert(name: string, source: string, result: any) {
    it(name, async() => {
      const [result, env, tenv] = await run(source, config);
      expect(result).to.equal(result);
    })  
  }

  function assertError(name: string, source: string) {
    it(name, async() => {
      try{
        const [result, env] = await run(source, config);
        expect(result).to.be.an('Error');
      } catch (err) {
        expect(err).to.be.an('Error');
      }
    })  
  }

  function runWasm(name : string, source : string, expected : any) {
    it(name, async() => {
      const result = await runWat(source, {});
      expect(result).to.equal(expected);
    });
  }

  runWasm('i64 return value', '(module (func (export "exported_func") (result i64) (i64.const 234)))', BigInt(234));

  assert('add', "2 + 3", 2 + 3);

  assert('add3', "2 + 3 + 4", 2 + 3 + 4);

  assert('add-overflow', "4294967295 + 1",0);

  assert('sub', "1 - 2", 1 - 2);

  assert('sub-underflow', "0 - 4294967295 - 1", 0);

  assert('mul', "2 * 3 * 4", 2 * 3 * 4);

  assert('mul-then-plus', "2 + 3 * 4", 2 + 3 * 4);

  assert('abs', "abs(0 - 5)", Math.abs(0 - 5));

  assert('min', 'min(2, 3)', Math.min(2,3));

  assert('max', 'max(2, 3)', Math.max(2,3));

  assert('pow', 'pow(2, 3)', Math.pow(2,3));

  assert('pow-negative', 'pow(2, 0 - 1)', 0);

  assert('simple-def', 'def f(x: int) -> int: return x + 1\nf(5)', 6);

  assert('multi-arg', 'def f(x: int, y: int, z: int) -> int: return x - y - z\nf(9, 3, 1)', 5);

  assert('multi-arg-again', 'def f(x: int, y: int, z: int) -> int: return x * y - z\nf(9, 3, 1)', 26);

  assert('multi-arg-update', `
def f(x: int, y: int, z: int) -> int:
  x = y * x
  return x - z
f(9, 3, 1)`, 26);

  assert('multi-arg-local-var', `
def f(x: int, y: int, z: int) -> int:
  m : int = 0
  m = y * x
  return m - z
f(9, 3, 1)`, 26);

  assert('global-local-same-name', `
x : int = 1
def f(y : int) -> int:
  x : int = 2
  return x
  
f(0)`, 2);

  assert("true", "True", true);

  assert("false", "False", false);

  assert("true and false", "True and False", false);

  assert("true and true", "True and True", true);

  assert("false and false", "False and False", false);

  assert("iftrue", `
if True:
  5
else:
  3`, 5);

  assert("init only", `
  x : int = 0
  x`, 0);

  assert("init before assign", `
  x : int = 0
  x = x + 2`, 2);

  assert("two inits", `
  x : int = 1
  y : int = 2
  y = y + x`, 3);

  // assertError("plustrue", "True + 1");

});
