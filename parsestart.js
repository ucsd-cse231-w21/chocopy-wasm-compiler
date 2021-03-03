"use strict";
exports.__esModule = true;
var parser_1 = require("./parser");
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
var source = "\n  items[1] = 6666666\n  ";
var result = parser_1.parse(source);
//console.log(JSON.stringify(result, null, 4));
//console.log(result);
console.log(result.funs);
console.log(result.inits);
console.log(result.classes);
console.log(result.stmts);
