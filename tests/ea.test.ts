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
            tag: "call",
            name: "f",
            arguments: [{ tag: "literal", value: { tag: "num", value: BigInt(5) } }],
            a: { tag: "number" },
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
          body: [
            {
              a: { tag: "number" },
              tag: "return",
              value: {
                a: { tag: "number" },
                tag: "call_expr",
                name: {
                  a: { tag: "callable", args: [], ret: { tag: "number" } },
                  tag: "id",
                  name: "f_$inc",
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
                  obj: { a: { tag: "class", name: "$ref" }, tag: "id", name: "x" },
                  field: "$deref",
                },
                right: {
                  tag: "literal",
                  value: { tag: "num", value: BigInt(1) },
                  a: { tag: "number" },
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
            tag: "call",
            name: "f",
            arguments: [
              { tag: "literal", value: { tag: "num", value: BigInt(6) }, a: { tag: "number" } },
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
                    a: { tag: "callable", args: [{ tag: "number" }], ret: { tag: "number" } },
                    tag: "id",
                    name: "f_$g",
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
                    a: { tag: "callable", args: [{ tag: "number" }], ret: { tag: "number" } },
                    tag: "id",
                    name: "f_$g",
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
                  obj: { a: { tag: "class", name: "$ref" }, tag: "id", name: "x" },
                  field: "$deref",
                },
                right: {
                  a: { tag: "number" },
                  tag: "call_expr",
                  name: {
                    a: { tag: "callable", args: [{ tag: "number" }], ret: { tag: "number" } },
                    tag: "lookup",
                    obj: { a: { tag: "class", name: "$ref" }, tag: "id", name: "h" },
                    field: "$deref",
                  },
                  arguments: [{ a: { tag: "number" }, tag: "id", name: "y" }],
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
          body: [
            {
              a: { tag: "none" },
              tag: "field-assign",
              obj: { a: { tag: "class", name: "$ref" }, tag: "id", name: "x" },
              field: "$deref",
              value: { a: { tag: "number" }, tag: "id", name: "z" },
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
                  obj: { a: { tag: "class", name: "$ref" }, tag: "id", name: "x" },
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
