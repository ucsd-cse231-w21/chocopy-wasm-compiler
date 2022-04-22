import { BasicREPL } from "./repl";
import { importObject } from "./tests/import-object.test";


// entry point for debugging
var source = `
x : int = 5
sum : int = 0
while x != 0:
  sum = sum + x
  x = x - 1
print(sum)

`
const repl = new BasicREPL(importObject);
const result = repl.run(source).then(result => {
  console.log(result);    
})

