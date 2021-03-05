/** Tests for escape analysis */

import { expect } from "chai";
import { BinOp } from "../ast";
import { ea } from "../ea";
import { parse } from "../parser";
import { tc, emptyGlobalTypeEnv } from "../type-check";

describe("ea(tAst) function", () => {
  // Use this function in debug prompt to get the result
  // JSON.stringify(fAst, (key, value) => (typeof value === "bigint" ? value.toString() : value));

  it("ea case 1", () => {
    const code = `
def f(x: int) -> int:
  def inc() -> int:
    return x + 1
  return inc()
f(5)
`;
    const parsed = parse(code);
    const [tAst, _] = tc(emptyGlobalTypeEnv(), parsed);
    const fAst = ea(tAst);

    expect(fAst).to.deep.equal({
      a: { tag: "number" },
      funs: [],
      inits: [],
      classes: [],
      stmts: [
        {
          a: { tag: "number" },
          tag: "expr",
          expr: {
            a: { tag: "number" },
            tag: "call_expr",
            name: {
              a: {
                tag: "callable",
                args: [{ tag: "number" }],
                ret: { tag: "number" },
                isVar: false,
              },
              tag: "id",
              name: "f",
            },
            arguments: [
              { a: { tag: "number" }, tag: "literal", value: { tag: "num", value: BigInt(5) } },
            ],
          },
        },
      ],
      closures: [
        {
          a: { tag: "none" },
          name: "f",
          parameters: [{ name: "x", type: { tag: "number" } }],
          ret: { tag: "number" },
          nonlocals: [],
          nested: ["f_$inc"],
          inits: [],
          isGlobal: true,
          body: [
            {
              a: { tag: "number" },
              tag: "return",
              value: {
                a: { tag: "number" },
                tag: "call_expr",
                name: {
                  a: { tag: "callable", args: [], ret: { tag: "number" }, isVar: false },
                  tag: "lookup",
                  obj: { a: { tag: "class", name: "$ref" }, tag: "id", name: "f_$inc_$ref" },
                  field: "$deref",
                },
                arguments: [],
              },
            },
          ],
        },
        {
          a: { tag: "none" },
          name: "f_$inc",
          parameters: [],
          ret: { tag: "number" },
          nonlocals: ["x"],
          nested: [],
          inits: [],
          isGlobal: false,
          body: [
            {
              a: { tag: "number" },
              tag: "return",
              value: {
                a: { tag: "number" },
                tag: "binop",
                op: BinOp.Plus,
                left: {
                  a: { tag: "number" },
                  tag: "lookup",
                  obj: { a: { tag: "class", name: "$ref" }, tag: "id", name: "x_$ref" },
                  field: "$deref",
                },
                right: {
                  a: { tag: "number" },
                  tag: "literal",
                  value: { tag: "num", value: BigInt(1) },
                },
              },
            },
          ],
        },
      ],
    });
  });

  it("ea case 2", () => {
    const code = `
def f(x : int) -> int:
  def g(y : int) -> int:
    return x + h(y)
  def h(z : int) -> int:
    nonlocal x
    x = z
    return x + 1
  return g(10) + g(7)
f(6)
`;
    const parsed = parse(code);
    const [tAst, _] = tc(emptyGlobalTypeEnv(), parsed);
    const fAst = ea(tAst);

    expect(fAst).to.deep.equal({
      a: { tag: "number" },
      funs: [],
      inits: [],
      classes: [],
      stmts: [
        {
          a: { tag: "number" },
          tag: "expr",
          expr: {
            a: { tag: "number" },
            tag: "call_expr",
            name: {
              a: {
                tag: "callable",
                args: [{ tag: "number" }],
                ret: { tag: "number" },
                isVar: false,
              },
              tag: "id",
              name: "f",
            },
            arguments: [
              { a: { tag: "number" }, tag: "literal", value: { tag: "num", value: BigInt(6) } },
            ],
          },
        },
      ],
      closures: [
        {
          a: { tag: "none" },
          name: "f",
          parameters: [{ name: "x", type: { tag: "number" } }],
          ret: { tag: "number" },
          nonlocals: [],
          nested: ["f_$g", "f_$h"],
          inits: [],
          isGlobal: true,
          body: [
            {
              a: { tag: "number" },
              tag: "return",
              value: {
                a: { tag: "number" },
                tag: "binop",
                op: BinOp.Plus,
                left: {
                  a: { tag: "number" },
                  tag: "call_expr",
                  name: {
                    a: {
                      tag: "callable",
                      args: [{ tag: "number" }],
                      ret: { tag: "number" },
                      isVar: false,
                    },
                    tag: "lookup",
                    obj: { a: { tag: "class", name: "$ref" }, tag: "id", name: "f_$g_$ref" },
                    field: "$deref",
                  },
                  arguments: [
                    {
                      a: { tag: "number" },
                      tag: "literal",
                      value: { tag: "num", value: BigInt(10) },
                    },
                  ],
                },
                right: {
                  a: { tag: "number" },
                  tag: "call_expr",
                  name: {
                    a: {
                      tag: "callable",
                      args: [{ tag: "number" }],
                      ret: { tag: "number" },
                      isVar: false,
                    },
                    tag: "lookup",
                    obj: { a: { tag: "class", name: "$ref" }, tag: "id", name: "f_$g_$ref" },
                    field: "$deref",
                  },
                  arguments: [
                    {
                      a: { tag: "number" },
                      tag: "literal",
                      value: { tag: "num", value: BigInt(7) },
                    },
                  ],
                },
              },
            },
          ],
        },
        {
          a: { tag: "none" },
          name: "f_$g",
          parameters: [{ name: "y", type: { tag: "number" } }],
          ret: { tag: "number" },
          nonlocals: ["x", "f_$h"],
          nested: [],
          inits: [],
          isGlobal: false,
          body: [
            {
              a: { tag: "number" },
              tag: "return",
              value: {
                a: { tag: "number" },
                tag: "binop",
                op: BinOp.Plus,
                left: {
                  a: { tag: "number" },
                  tag: "lookup",
                  obj: { a: { tag: "class", name: "$ref" }, tag: "id", name: "x_$ref" },
                  field: "$deref",
                },
                right: {
                  a: { tag: "number" },
                  tag: "call_expr",
                  name: {
                    a: {
                      tag: "callable",
                      args: [{ tag: "number" }],
                      ret: { tag: "number" },
                      isVar: false,
                    },
                    tag: "lookup",
                    obj: { a: { tag: "class", name: "$ref" }, tag: "id", name: "f_$h_$ref" },
                    field: "$deref",
                  },
                  arguments: [
                    {
                      a: { tag: "number" },
                      tag: "lookup",
                      obj: { a: { tag: "class", name: "$ref" }, tag: "id", name: "y_$ref" },
                      field: "$deref",
                    },
                  ],
                },
              },
            },
          ],
        },
        {
          a: { tag: "none" },
          name: "f_$h",
          parameters: [{ name: "z", type: { tag: "number" } }],
          ret: { tag: "number" },
          nonlocals: ["x"],
          nested: [],
          inits: [],
          isGlobal: false,
          body: [
            {
              a: { tag: "none" },
              tag: "assignment",
              value: {
                a: { tag: "number" },
                tag: "lookup",
                obj: { a: { tag: "class", name: "$ref" }, tag: "id", name: "z_$ref" },
                field: "$deref",
              },
              destruct: {
                valueType: { tag: "number" },
                isDestructured: false,
                targets: [
                  {
                    starred: false,
                    ignore: false,
                    target: {
                      a: { tag: "number" },
                      tag: "lookup",
                      obj: { a: { tag: "class", name: "$ref" }, tag: "id", name: "x_$ref" },
                      field: "$deref",
                    },
                  },
                ],
              },
            },
            {
              a: { tag: "number" },
              tag: "return",
              value: {
                a: { tag: "number" },
                tag: "binop",
                op: BinOp.Plus,
                left: {
                  a: { tag: "number" },
                  tag: "lookup",
                  obj: { a: { tag: "class", name: "$ref" }, tag: "id", name: "x_$ref" },
                  field: "$deref",
                },
                right: {
                  a: { tag: "number" },
                  tag: "literal",
                  value: { tag: "num", value: BigInt(1) },
                },
              },
            },
          ],
        },
      ],
    });
  });
});
