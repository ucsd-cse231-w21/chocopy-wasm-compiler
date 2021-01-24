import {parse} from "./parser";

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
def fib(n : int) -> int:
  if n < 2:
    return 1
  else:
    return n * fib(n - 1)

fib(1)`)

console.log(JSON.stringify(result, null, 4));
