import * as mocha from "mocha";
import { expect } from "chai";
import { parser } from "lezer-python";
import { UniOp, BinOp } from "../ast";
// TODO: add additional tests here to ensure parse works as expected
import { traverseExpr, traverseStmt, traverse, parse, traverseVarInit } from "../parser";
import { singleVarAssignment } from "./utils.test";

// We write tests for each function in parser.ts here. Each function gets its
// own describe statement. Each it statement represents a single test. You
// should write enough unit tests for each function until you are confident
// the parser works as expected.
// describe('traverseExpr(c, s) function', () => {
//   it('parses a number in the beginning', () => {
//     const source = "987";
//     const cursor = parser.parse(source).cursor();

// We write tests for each function in parser.ts here. Each function gets its
// own describe statement. Each it statement represents a single test. You
// should write enough unit tests for each function until you are confident
// the parser works as expected.
describe("traverseExpr(c, s) function", () => {
  it("parses a number in the beginning", () => {
    const source = "987";
    const cursor = parser.parse(source).cursor();

    // go to statement
    cursor.firstChild();
    // go to expression
    cursor.firstChild();

    const parsedExpr = traverseExpr(cursor, source);

    // Note: we have to use deep equality when comparing objects
    expect(parsedExpr).to.deep.equal({
      a: {
        fileId: 1,
        col: 1,
        length: 3,
        line: 1,
      },
      tag: "literal",
      value: {
        tag: "num",
        value: BigInt(987),
      },
    });
  });
  // TODO: add additional tests here to ensure traverseExpr works as expected
  it("parses None in the beginning", () => {
    const source = "None";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();
    const parsedExpr = traverseExpr(cursor, source);

    expect(parsedExpr).to.deep.equal({
      a: {
        fileId: 1,
        col: 1,
        length: 4,
        line: 1,
      },
      tag: "literal",
      value: { tag: "none" },
    });
  });

  it("parses a uniop", () => {
    const source = "not True";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();
    const parsedExpr = traverseExpr(cursor, source);

    expect(parsedExpr).to.deep.equal({
      a: {
        fileId: 1,
        col: 1,
        length: 8,
        line: 1,
      },
      tag: "uniop",
      op: UniOp.Not,
      expr: {
        a: {
          fileId: 1,
          col: 5,
          length: 4,
          line: 1,
        },
        tag: "literal",
        value: { tag: "bool", value: true },
      },
    });
  });

  it("parses a binop", () => {
    const source = "7 - 3";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();
    const parsedExpr = traverseExpr(cursor, source);

    expect(parsedExpr).to.deep.equal({
      a: {
        fileId: 1,
        col: 1,
        length: 5,
        line: 1,
      },
      tag: "binop",
      op: BinOp.Minus,
      left: {
        a: {
          fileId: 1,
          col: 1,
          length: 1,
          line: 1,
        },
        tag: "literal",
        value: { tag: "num", value: BigInt(7) },
      },
      right: {
        a: {
          fileId: 1,
          col: 5,
          length: 1,
          line: 1,
        },
        tag: "literal",
        value: { tag: "num", value: BigInt(3) },
      },
    });
  });

  it("parses a list", () => {
    const source = "[1, 2, 3]";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();
    const parsedExpr = traverseExpr(cursor, source);

    expect(parsedExpr).to.deep.equal({
      tag: "list-expr",
      a: {
        fileId: 1,
        col: 1,
        length: 9,
        line: 1,
      },
      contents: [
        {
          a: {
            fileId: 1,
            col: 2,
            length: 1,
            line: 1,
          },
          tag: "literal",
          value: { tag: "num", value: BigInt(1) },
        },
        {
          a: {
            fileId: 1,
            col: 5,
            length: 1,
            line: 1,
          },
          tag: "literal",
          value: { tag: "num", value: BigInt(2) },
        },
        {
          a: {
            fileId: 1,
            col: 8,
            length: 1,
            line: 1,
          },
          tag: "literal",
          value: { tag: "num", value: BigInt(3) },
        },
      ],
    });
  });

  it("parses a list lookup", () => {
    const source = "items[6]";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();
    const parsedExpr = traverseExpr(cursor, source);

    expect(parsedExpr).to.deep.equal({
      a: {
        fileId: 1,
        col: 1,
        length: 8,
        line: 1,
      },
      tag: "bracket-lookup",
      obj: {
        a: {
          fileId: 1,
          col: 1,
          length: 5,
          line: 1,
        },
        tag: "id",
        name: "items",
      },
      key: {
        a: {
          fileId: 1,
          col: 7,
          length: 1,
          line: 1,
        },
        tag: "literal",
        value: { tag: "num", value: BigInt(6) },
      },
    });
  });
});

describe("parse(source) function", () => {
  it("parse a typed dict variable initialization", () => {
    const parsed = parse("d:[int, bool] = None");
    expect(parsed.inits).to.deep.equal([
      {
        a: {
          col: 1,
          length: 20,
          line: 1,
          fileId: 1,
        },
        name: "d",
        type: {
          tag: "dict",
          key: { tag: "number" },
          value: { tag: "bool" },
        }, //end of type
        value: { tag: "none" },
      },
    ]);
  });

  it("parse a number", () => {
    const parsed = parse("987");
    expect(parsed.stmts).to.deep.equal([
      {
        a: {
          fileId: 1,
          col: 1,
          length: 3,
          line: 1,
        },
        tag: "expr",
        expr: {
          a: {
            fileId: 1,
            col: 1,
            length: 3,
            line: 1,
          },
          tag: "literal",
          value: { tag: "num", value: BigInt(987) },
        },
      },
    ]);
  });
});

describe("parse(source) function", () => {
  it("parse a Callable[[], None] type initialization", () => {
    const parsed = parse("f:Callable[[], None] = None");
    expect(parsed.inits).to.deep.equal([
      {
        a: {
          fileId: 1,
          col: 1,
          length: 27,
          line: 1,
        },
        name: "f",
        type: {
          tag: "callable",
          args: [],
          ret: { tag: "none" },
        }, //end of type
        value: { tag: "none" },
      },
    ]);
  });

  // TODO: add additional tests here to ensure parse works as expected
  it("parse a Callable[[int], bool] type initialization", () => {
    const parsed = parse("f:Callable[[int], bool] = None");
    expect(parsed.inits).to.deep.equal([
      {
        a: {
          fileId: 1,
          col: 1,
          length: 30,
          line: 1,
        },
        name: "f",
        type: {
          tag: "callable",
          args: [{ name: "callable_0", type: { tag: "number" } }],
          ret: { tag: "bool" },
        }, //end of type
        value: { tag: "none" },
      },
    ]);
  });

  it("parse an empty dict expression", () => {
    const parsed = parse("d = {}");
    expect(parsed.stmts).to.deep.equal([
      singleVarAssignment(
        "d",
        {
          a: {
            fileId: 1,
            col: 5,
            length: 2,
            line: 1,
          },
          tag: "dict",
          entries: [],
        },
        {
          fileId: 1,
          col: 1,
          length: 1,
          line: 1,
        },
        {
          fileId: 1,
          col: 1,
          length: 1,
          line: 1,
        },
        {
          fileId: 1,
          col: 1,
          length: 6,
          line: 1,
        }
      ),
    ]);
  });

  it("parse a dict expression", () => {
    const parsed = parse("d = {2:True}");
    expect(parsed.stmts).to.deep.equal([
      singleVarAssignment(
        "d",
        {
          a: {
            fileId: 1,
            col: 5,
            length: 8,
            line: 1,
          },
          tag: "dict",
          entries: [
            [
              {
                a: {
                  fileId: 1,
                  col: 6,
                  length: 1,
                  line: 1,
                },
                tag: "literal",
                value: { tag: "num", value: 2n },
              },
              {
                a: {
                  fileId: 1,
                  col: 8,
                  length: 4,
                  line: 1,
                },
                tag: "literal",
                value: { tag: "bool", value: true },
              },
            ],
          ],
        },
        {
          fileId: 1,
          col: 1,
          length: 1,
          line: 1,
        },
        {
          fileId: 1,
          col: 1,
          length: 1,
          line: 1,
        },
        {
          fileId: 1,
          col: 1,
          length: 12,
          line: 1,
        }
      ),
    ]);
  });

  it("parse a nested dict expression", () => {
    const parsed = parse("d = {2:{4:True}}");
    expect(parsed.stmts).to.deep.equal([
      singleVarAssignment(
        "d",
        {
          a: {
            fileId: 1,
            col: 5,
            length: 12,
            line: 1,
          },
          tag: "dict",
          entries: [
            [
              {
                a: {
                  fileId: 1,
                  col: 6,
                  length: 1,
                  line: 1,
                },
                tag: "literal",
                value: { tag: "num", value: 2n },
              },
              {
                tag: "dict",
                a: {
                  fileId: 1,
                  col: 8,
                  length: 8,
                  line: 1,
                },
                entries: [
                  [
                    {
                      a: {
                        fileId: 1,
                        col: 9,
                        length: 1,
                        line: 1,
                      },
                      tag: "literal",
                      value: { tag: "num", value: 4n },
                    },
                    {
                      a: {
                        fileId: 1,
                        col: 11,
                        length: 4,
                        line: 1,
                      },
                      tag: "literal",
                      value: { tag: "bool", value: true },
                    },
                  ],
                ],
              },
            ],
          ],
        },
        {
          fileId: 1,
          col: 1,
          length: 1,
          line: 1,
        },
        {
          fileId: 1,
          col: 1,
          length: 1,
          line: 1,
        },
        {
          fileId: 1,
          col: 1,
          length: 16,
          line: 1,
        }
      ),
    ]);
  });

  it("parse a Callable[[int, Callable[[int], bool]], Foo] type initialization", () => {
    const parsed = parse("f:Callable[[int, Callable[[int], bool]], Foo] = None");
    expect(parsed.inits).to.deep.equal([
      {
        a: {
          fileId: 1,
          col: 1,
          length: 52,
          line: 1,
        },
        name: "f",
        type: {
          tag: "callable",
          args: [
            { name: "callable_0", type: { tag: "number" } },
            {
              name: "callable_1",
              type: {
                tag: "callable",
                args: [{ name: "callable_0", type: { tag: "number" } }],
                ret: { tag: "bool" },
              },
            },
          ],
          ret: { tag: "class", name: "Foo" },
        }, //end of type
        value: { tag: "none" },
      },
    ]);
  });

  it("parse a Callable[[int, bool], Foo] type initialization", () => {
    const parsed = parse("f:Callable[[int, bool], Foo] = None");
    expect(parsed.inits).to.deep.equal([
      {
        a: {
          fileId: 1,
          col: 1,
          length: 35,
          line: 1,
        },
        name: "f",
        type: {
          tag: "callable",
          args: [
            { name: "callable_0", type: { tag: "number" } },
            { name: "callable_1", type: { tag: "bool" } },
          ],
          ret: { tag: "class", name: "Foo" },
        }, //end of type
        value: { tag: "none" },
      },
    ]);
  });

  it("parse a nested function", () => {
    const parsed = parse(`
            def f(x: int) -> int:
                def g() -> int:
                    return x
                return g()
        `);
    expect(parsed.funs).to.deep.equal([
      {
        a: {
          fileId: 1,
          col: 13,
          length: 110,
          line: 2,
        },
        name: "f",
        parameters: [{ name: "x", type: { tag: "number" } }],
        ret: { tag: "number" },
        decls: [],
        inits: [],
        funs: [
          {
            a: {
              fileId: 1,
              col: 17,
              length: 45,
              line: 3,
            },
            name: "g",
            parameters: [],
            ret: { tag: "number" },
            decls: [],
            inits: [],
            funs: [],
            body: [
              {
                a: {
                  fileId: 1,
                  col: 21,
                  length: 8,
                  line: 4,
                },
                tag: "return",
                value: {
                  a: {
                    fileId: 1,
                    col: 28,
                    length: 1,
                    line: 4,
                  },
                  tag: "id",
                  name: "x",
                },
              },
            ],
          },
        ],
        body: [
          {
            a: {
              fileId: 1,
              col: 17,
              length: 10,
              line: 5,
            },
            tag: "return",
            value: {
              a: {
                fileId: 1,
                col: 24,
                length: 3,
                line: 5,
              },
              tag: "call_expr",
              name: {
                a: {
                  fileId: 1,
                  col: 24,
                  length: 3,
                  line: 5,
                },
                tag: "id",
                name: "g",
              },
              arguments: [],
            },
          },
        ],
      },
    ]);
  });

  it("parse a nested function with nonlocal", () => {
    const parsed = parse(`
            def f(x: int) -> Callable[[], bool]:
                def k():
                    pass
                def g() -> bool:
                    nonlocal x
                    return True
                return g
        `);
    expect(parsed.funs).to.deep.equal([
      {
        a: {
          fileId: 1,
          col: 13,
          length: 208,
          line: 2,
        },
        name: "f",
        parameters: [{ name: "x", type: { tag: "number" } }],
        ret: { tag: "callable", args: [], ret: { tag: "bool" } },
        decls: [],
        inits: [],
        funs: [
          {
            a: {
              fileId: 1,
              col: 17,
              length: 34,
              line: 3,
            },
            name: "k",
            parameters: [],
            ret: { tag: "none" },
            decls: [],
            inits: [],
            funs: [],
            body: [
              {
                a: {
                  fileId: 1,
                  col: 21,
                  length: 4,
                  line: 4,
                },
                tag: "pass",
              },
            ],
          },
          {
            a: {
              fileId: 1,
              col: 17,
              length: 80,
              line: 5,
            },
            name: "g",
            parameters: [],
            ret: { tag: "bool" },
            decls: [
              {
                a: {
                  fileId: 1,
                  col: 21,
                  length: 10,
                  line: 6,
                },
                tag: "nonlocal",
                name: "x",
              },
            ],
            inits: [],
            funs: [],
            body: [
              {
                a: {
                  fileId: 1,
                  col: 21,
                  length: 11,
                  line: 7,
                },
                tag: "return",
                value: {
                  a: {
                    fileId: 1,
                    col: 28,
                    length: 4,
                    line: 7,
                  },
                  tag: "literal",
                  value: { tag: "bool", value: true },
                },
              },
            ],
          },
        ],
        body: [
          {
            a: {
              fileId: 1,
              col: 17,
              length: 8,
              line: 8,
            },
            tag: "return",
            value: {
              a: {
                fileId: 1,
                col: 24,
                length: 1,
                line: 8,
              },
              tag: "id",
              name: "g",
            },
          },
        ],
      },
    ]);
  });

  it("parse a function call with callable return type", () => {
    const parsed = parse(`id(f())(5)`);
    expect(parsed.stmts).to.deep.equal([
      {
        a: {
          fileId: 1,
          col: 1,
          length: 10,
          line: 1,
        },
        tag: "expr",
        expr: {
          a: {
            fileId: 1,
            col: 1,
            length: 10,
            line: 1,
          },
          tag: "call_expr",
          name: {
            a: {
              fileId: 1,
              col: 1,
              length: 7,
              line: 1,
            },
            tag: "call_expr",
            name: {
              a: {
                fileId: 1,
                col: 1,
                length: 7,
                line: 1,
              },
              tag: "id",
              name: "id",
            },
            arguments: [
              {
                a: {
                  fileId: 1,
                  col: 4,
                  length: 3,
                  line: 1,
                },
                tag: "call_expr",
                name: {
                  a: {
                    fileId: 1,
                    col: 4,
                    length: 3,
                    line: 1,
                  },
                  tag: "id",
                  name: "f",
                },
                arguments: [],
              },
            ],
          },
          arguments: [
            {
              a: {
                fileId: 1,
                col: 9,
                length: 1,
                line: 1,
              },
              tag: "literal",
              value: { tag: "num", value: 5n },
            },
          ],
        },
      },
    ]);
  });

  it("parse a method call with callable return type", () => {
    const parsed = parse(`a.id()(5)`);
    expect(parsed.stmts).to.deep.equal([
      {
        a: {
          fileId: 1,
          col: 1,
          length: 9,
          line: 1,
        },
        tag: "expr",
        expr: {
          tag: "call_expr",
          name: {
            a: {
              fileId: 1,
              col: 1,
              length: 6,
              line: 1,
            },
            tag: "method-call",
            obj: {
              a: {
                fileId: 1,
                col: 1,
                length: 1,
                line: 1,
              },
              tag: "id",
              name: "a",
            },
            method: "id",
            arguments: [],
          },
          a: {
            fileId: 1,
            col: 1,
            length: 9,
            line: 1,
          },
          arguments: [
            {
              a: {
                fileId: 1,
                col: 8,
                length: 1,
                line: 1,
              },
              tag: "literal",
              value: { tag: "num", value: 5n },
            },
          ],
        },
      },
    ]);
  });

  it("parse a lambda expression (no arg)", () => {
    const parsed = parse(`lambda a : a + 10`);
    expect(parsed.stmts).to.deep.equal([
      {
        a: {
          fileId: 1,
          col: 1,
          length: 17,
          line: 1,
        },
        tag: "expr",
        expr: {
          a: {
            fileId: 1,
            col: 1,
            length: 17,
            line: 1,
          },
          tag: "lambda",
          args: ["a"],
          ret: {
            a: {
              fileId: 1,
              col: 12,
              length: 6,
              line: 1,
            },
            tag: "binop",
            op: BinOp.Plus,
            left: {
              a: {
                fileId: 1,
                col: 12,
                length: 1,
                line: 1,
              },
              tag: "id",
              name: "a",
            },
            right: {
              a: {
                fileId: 1,
                col: 16,
                length: 2,
                line: 1,
              },
              tag: "literal",
              value: { tag: "num", value: 10n },
            },
          },
        },
      },
    ]);
  });

  it("parse a lambda expression (multiple arg)", () => {
    const parsed = parse(`lambda a, b, c : 10`);
    expect(parsed.stmts).to.deep.equal([
      {
        a: {
          fileId: 1,
          col: 1,
          length: 19,
          line: 1,
        },
        tag: "expr",
        expr: {
          a: {
            fileId: 1,
            col: 1,
            length: 19,
            line: 1,
          },
          tag: "lambda",
          args: ["a", "b", "c"],
          ret: {
            a: {
              col: 18,
              fileId: 1,
              length: 2,
              line: 1,
            },
            tag: "literal",
            value: { tag: "num", value: 10n },
          },
        },
      },
    ]);
  });
});
