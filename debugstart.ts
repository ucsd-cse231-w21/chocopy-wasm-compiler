import { parse } from "./parser";
import { BasicREPL } from "./repl";
import { importObject, addLibs  } from "./tests/import-object.test";


// entry point for debugging
async function debug() {
  var source = `
class C(object):
def fib(self: C, n: int) -> int:
  if n <= 0:
    return 1
  else:
    return n * self.fib(n-1)
print(C().fib(5))
`
  const ast = parse(source);
  
  const repl = new BasicREPL(await addLibs());
  const result = repl.run(source).then(result => {
    console.log(result);    
  })  
}

debug();

