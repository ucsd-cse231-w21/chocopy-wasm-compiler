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
    print_num: (arg: number) =>  {
      importObject.output += arg;
      importObject.output += "\n";
      return arg;
    },
    print_bool: (arg: boolean) => {
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
  const config : Config = { 
    importObject, 
    env: emptyEnv, 
    typeEnv: defaultTypeEnv };

  function assert(name: string, source: string, expected: any) {
    it(name, async() => {
      const [result, env, tenv] = await run(source, config);
      expect(result).to.equal(expected);
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

  assert("nestedif", `
if True:
  if False:
    0
  else:
    1
else:
  2`, 1);

  assert("return inside if", `
def f(x : int) -> int:
  if x > 0:
    return x
  else:
    return 0
f(2)`, 2);

  assert("init only", `
  x : int = 2
  x`, 2);

  assert("init before assign", `
  x : int = 0
  x = x + 2
  x`, 2);

  assert("two inits", `
  x : int = 1
  y : int = 2
  y = y + x
  y`, 3);

  assert("init before def", `
  x : int = 2
  def f() -> int:
    return x
  f()`, 2);

  assert("id fun 1", `
  def id(x: int) -> int:
    return x
  id(1)`, 1);

  assert("id fun 2", `
  def id_helper(x : int) -> int:
    return x

  def id(x: int) -> int:
    return id_helper(x)

  id(1) + id(2)`, 3);

  assert("fib(1)",`
  def fib(n : int) -> int:
    if n < 2:
      return 1
    else:
      return n * fib(n - 1)
  fib(1)`, 1);

  assert("fib(2)",`
  def fib(n : int) -> int:
    if n < 2:
      return 1
    else:
      return n * fib(n - 1)
  fib(2)`, 2);

  assert("fib(3)",`
  def fib(n : int) -> int:
    if n < 2:
      return 1
    else:
      return n * fib(n - 1)
  fib(3)`, 6);

  assert("mutual recursion1", `
  def is_even(x : int) -> bool:
    if x < 1:
      return True
    else:
      return is_odd(x-1)

  def is_odd(x : int) -> bool:
    return is_even(x - 1)

  is_even(4)`, true);

  assert("mutual recursion2", `
  def is_even(x : int) -> bool:
    if x < 1:
      return True
    else:
      return is_odd(x-1)

  def is_odd(x : int) -> bool:
    if x < 1:
      return False
    else:
      return is_even(x - 1)

  is_even(3)`, false);

  assert("two prints", `
  print(True)
  print(1)`, 1);

  assert("while true", `
  x : int = 3
  fib : int = 1
  while x > 1:
    fib = fib * x
    x = x - 1
  fib`, 6);

  assert("parenthesized expr", `
  (1 + 1) * 5`, 10);

  assert("negative", `-1`, -1);

  assert("negative", `not True`, false);

  assert("negative", `not False`, true);
});
