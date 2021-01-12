import { run } from '../runner';
import { expect } from 'chai';
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
  const config = { importObject };

  it('add', async() => {
    const result = await run("2 + 3", config);
    expect(result).to.equal(2 + 3);
  })

  it('add3', async() => {
    const result = await run("2 + 3 + 4", config);
    expect(result).to.equal(2 + 3 + 4);
  })

  it('addoverflow', async() => {
    const result = await run("4294967295 + 1", config);
    expect(result).to.equal(0);
  })

  it('sub', async() => {
    const result = await run("1 - 2", config);
    expect(result).to.equal(1 - 2);
  })

  it('subunderflow', async() => {
    const result = await run("0 - 4294967295 - 1", config);
    expect(result).to.equal(0);
  })

  it('mul', async() => {
    const result = await run("2 * 3 * 4", config);
    expect(result).to.equal(2 * 3 * 4);
  })

  it('multhenplus', async() => {
    const result = await run("2 + 3 * 4", config);
    expect(result).to.equal(2 + 3 * 4);
  })

  it('abs', async() => {
    const result = await run("abs(0 - 5)", config);
    expect(result).to.equal(Math.abs(0 - 5));
  })

  it('min', async() => {
    const result = await run('min(2, 3)', config);
    expect(result).to.equal(Math.min(2,3));
  })

  it('max', async() => {
    const result = await run('max(2, 3)', config);
    expect(result).to.equal(Math.max(2,3));
  })

  it('pow', async() => {
    const result = await run('pow(2, 3)', config);
    expect(result).to.equal(Math.pow(2,3));
  })

  it('pownegative', async() => {
    const result = await run('pow(2, 0 - 1)', config);
    expect(result).to.equal(0);
  })
});