import { BasicREPL } from "./repl";
import { importObject } from "./tests/import-object.test";


// entry point for debugging
var source = `
class C(object):
  x : int = 123
  def new(self: C, x: int) -> C:
    print(self.x)
    self.x = x
    print(self.x)
    return self
  def clear(self: C) -> C:
    return self.new(123)

C().new(42).clear()
`
const repl = new BasicREPL(importObject);
const result = repl.run(source).then(result => {
  console.log(result);    
})

