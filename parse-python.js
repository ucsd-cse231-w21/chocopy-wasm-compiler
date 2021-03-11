const python = require("lezer-python");

const input = `def x(a, b):
                 pass`;

const tree = python.parser.parse(input);

const cursor = tree.cursor();

// do {
//   //  console.log(cursor.node);
//   console.log(cursor.node.type.name);
//   console.log(input.substring(cursor.node.from, cursor.node.to));
// } while (cursor.next());

cursor.firstChild()
cursor.firstChild()

cursor.nextSibling()
cursor.nextSibling()

cursor.firstChild()
cursor.nextSibling()
// cursor.nextSibling()
// cursor.nextSibling()

console.log(cursor.node.type.name);
console.log(input.substring(cursor.node.from, cursor.node.to));


