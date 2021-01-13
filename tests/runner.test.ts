import { run } from '../runner';
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
  const config = { importObject, env: emptyEnv };

  it('add', async() => {
    const [result, env] = await run("2 + 3", config);
    expect(result).to.equal(2 + 3);
  })

  it('add3', async() => {
    const [result, env] = await run("2 + 3 + 4", config);
    expect(result).to.equal(2 + 3 + 4);
  })

  it('addoverflow', async() => {
    const [result, env] = await run("4294967295 + 1", config);
    expect(result).to.equal(0);
  })

  it('sub', async() => {
    const [result, env] = await run("1 - 2", config);
    expect(result).to.equal(1 - 2);
  })

  it('subunderflow', async() => {
    const [result, env] = await run("0 - 4294967295 - 1", config);
    expect(result).to.equal(0);
  })

  it('mul', async() => {
    const [result, env] = await run("2 * 3 * 4", config);
    expect(result).to.equal(2 * 3 * 4);
  })

  it('multhenplus', async() => {
    const [result, env] = await run("2 + 3 * 4", config);
    expect(result).to.equal(2 + 3 * 4);
  })

  it('abs', async() => {
    const [result, env] = await run("abs(0 - 5)", config);
    expect(result).to.equal(Math.abs(0 - 5));
  })

  it('min', async() => {
    const [result, env] = await run('min(2, 3)', config);
    expect(result).to.equal(Math.min(2,3));
  })

  it('max', async() => {
    const [result, env] = await run('max(2, 3)', config);
    expect(result).to.equal(Math.max(2,3));
  })

  it('pow', async() => {
    const [result, env] = await run('pow(2, 3)', config);
    expect(result).to.equal(Math.pow(2,3));
  })

  it('pownegative', async() => {
    const [result, env] = await run('pow(2, 0 - 1)', config);
    expect(result).to.equal(0);
  })

  it('simpledef', async() => {
    const [result, env] = await run('def f(x): return x + 1\nf(5)', config);
    expect(result).to.equal(6);
  })

  it('multi-arg', async() => {
    const [result, env] = await run('def f(x, y, z): return x - y - z\nf(9, 3, 1)', config);
    expect(result).to.equal(5);
  })

  it('multi-arg-again', async() => {
    const [result, env] = await run('def f(x, y, z): return x * y - z\nf(9, 3, 1)', config);
    expect(result).to.equal(26);
  })

  it('multi-arg-update', async() => {
    const [result, env] = await run(`
def f(x, y, z):
  x = y * x
  return x - z
f(9, 3, 1)`, config);
    expect(result).to.equal(26);
  })

  it('multi-arg-local-var', async() => {
    const [result, env] = await run(`
def f(x, y, z):
  m = y * x
  return m - z
f(9, 3, 1)`, config);
    expect(result).to.equal(26);
  })
});