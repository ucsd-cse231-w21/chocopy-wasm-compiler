import { parse } from "./parser";

// var result = parse(`
// def f(x : int):
//     y : int = 0
//     y = y + 2
//     return x + y

// x : int = 0

// y : bool = True

// x = 2

// x = x + x`);

// var result = parse(`
// x : int = 0
// x = x + 2
// `);

var result = parse(`
while True:
  pass`);

console.log(JSON.stringify(result, null, 4));
