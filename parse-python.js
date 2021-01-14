const python = require('lezer-python');

const input = "def f(x: int, y: bool) -> int:\n  return x + y\nf(4, 5)";

const tree = python.parser.parse(input);

const cursor = tree.cursor();

do {
//  console.log(cursor.node);
  console.log(cursor.node.type.name);
  console.log(input.substring(cursor.node.from, cursor.node.to));
} while(cursor.next());

