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
      a: [
        { tag: "number" },
        {
          fileId: 1,
          col: 1,
          length: 104,
          line: 1,
        },
      ],
      funs: [],
      inits: [],
      classes: [],
      stmts: [
        {
          a: [
            { tag: "number" },
            {
              fileId: 1,
              col: 5,
              length: 4,
              line: 6,
            },
          ],
          tag: "expr",
          expr: {
            a: [
              { tag: "number" },
              {
                fileId: 1,
                col: 5,
                length: 4,
                line: 6,
              },
            ],
            tag: "call_expr",
            name: {
              a: [
                {
                  tag: "callable",
                  args: [{ name: "x", type: { tag: "number" } }],
                  ret: { tag: "number" },
                  isVar: false,
                },
                {
                  fileId: 1,
                  col: 5,
                  length: 4,
                  line: 6,
                },
              ],
              tag: "id",
              name: "f",
            },
            arguments: [
              {
                a: [{ tag: "number" }, { fileId: 1, col: 7, length: 1, line: 6 }],
                tag: "literal",
                value: { tag: "num", value: BigInt(5) },
              },
            ],
          },
        },
      ],
      closures: [
        {
          a: [
            { tag: "none" },
            {
              fileId: 1,
              col: 5,
              length: 86,
              line: 2,
            },
          ],
          name: "f",
          parameters: [{ name: "x", type: { tag: "number" } }],
          ret: { tag: "number" },
          nonlocals: [],
          nested: ["f_$inc"],
          inits: [],
          isGlobal: true,
          body: [
            {
              a: [{ tag: "number" }, { fileId: 1, col: 14, length: 5, line: 5 }],
              tag: "return",
              value: {
                a: [
                  { tag: "number" },
                  {
                    fileId: 1,
                    col: 14,
                    length: 5,
                    line: 5,
                  },
                ],
                tag: "call_expr",
                name: {
                  a: [
                    { tag: "callable", args: [], ret: { tag: "number" }, isVar: false },
                    {
                      fileId: 1,
                      col: 14,
                      length: 5,
                      line: 5,
                    },
                  ],
                  tag: "lookup",
                  obj: {
                    a: [
                      { tag: "class", name: "$ref" },
                      {
                        fileId: 1,
                        col: 14,
                        length: 5,
                        line: 5,
                      },
                    ],
                    tag: "id",
                    name: "f_$inc_$ref",
                  },
                  field: "$deref",
                },
                arguments: [],
              },
            },
          ],
        },
        {
          a: [
            { tag: "none" },
            {
              fileId: 1,
              col: 7,
              length: 39,
              line: 3,
            },
          ],
          name: "f_$inc",
          parameters: [],
          ret: { tag: "number" },
          nonlocals: ["x"],
          nested: [],
          inits: [],
          isGlobal: false,
          body: [
            {
              a: [
                { tag: "number" },
                {
                  fileId: 1,
                  col: 16,
                  length: 5,
                  line: 4,
                },
              ],
              tag: "return",
              value: {
                a: [
                  { tag: "number" },
                  {
                    fileId: 1,
                    col: 16,
                    length: 5,
                    line: 4,
                  },
                ],
                tag: "binop",
                op: BinOp.Plus,
                left: {
                  a: [
                    { tag: "number" },
                    {
                      fileId: 1,
                      col: 16,
                      length: 1,
                      line: 4,
                    },
                  ],
                  tag: "lookup",
                  obj: {
                    a: [
                      { tag: "class", name: "$ref" },
                      { line: 4, fileId: 1, col: 16, length: 1 },
                    ],
                    tag: "id",
                    name: "x_$ref",
                  },
                  field: "$deref",
                },
                right: {
                  a: [
                    { tag: "number" },
                    {
                      fileId: 1,
                      col: 20,
                      length: 1,
                      line: 4,
                    },
                  ],
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
      a: [
        { tag: "number" },
        {
          fileId: 1,
          col: 1,
          length: 203,
          line: 1,
        },
      ],
      funs: [],
      inits: [],
      classes: [],
      stmts: [
        {
          a: [
            { tag: "number" },
            {
              fileId: 1,
              col: 5,
              length: 4,
              line: 10,
            },
          ],
          tag: "expr",
          expr: {
            a: [
              { tag: "number" },
              {
                fileId: 1,
                col: 5,
                length: 4,
                line: 10,
              },
            ],
            tag: "call_expr",
            name: {
              a: [
                {
                  tag: "callable",
                  args: [{ name: "x", type: { tag: "number" } }],
                  ret: { tag: "number" },
                  isVar: false,
                },
                {
                  fileId: 1,
                  col: 5,
                  length: 4,
                  line: 10,
                },
              ],
              tag: "id",
              name: "f",
            },
            arguments: [
              {
                a: [
                  { tag: "number" },
                  {
                    fileId: 1,
                    col: 7,
                    length: 1,
                    line: 10,
                  },
                ],
                tag: "literal",
                value: { tag: "num", value: BigInt(6) },
              },
            ],
          },
        },
      ],
      closures: [
        {
          a: [
            { tag: "none" },
            {
              fileId: 1,
              col: 5,
              length: 185,
              line: 2,
            },
          ],
          name: "f",
          parameters: [{ name: "x", type: { tag: "number" } }],
          ret: { tag: "number" },
          nonlocals: [],
          nested: ["f_$g", "f_$h"],
          inits: [],
          isGlobal: true,
          body: [
            {
              a: [
                { tag: "number" },
                {
                  fileId: 1,
                  col: 14,
                  length: 12,
                  line: 9,
                },
              ],
              tag: "return",
              value: {
                a: [
                  { tag: "number" },
                  {
                    fileId: 1,
                    col: 14,
                    length: 12,
                    line: 9,
                  },
                ],
                tag: "binop",
                op: BinOp.Plus,
                left: {
                  a: [
                    { tag: "number" },
                    {
                      fileId: 1,
                      col: 14,
                      length: 5,
                      line: 9,
                    },
                  ],
                  tag: "call_expr",
                  name: {
                    a: [
                      {
                        tag: "callable",
                        args: [{ name: "y", type: { tag: "number" } }],
                        ret: { tag: "number" },
                        isVar: false,
                      },
                      {
                        fileId: 1,
                        col: 14,
                        length: 5,
                        line: 9,
                      },
                    ],
                    tag: "lookup",
                    obj: {
                      a: [
                        { tag: "class", name: "$ref" },
                        {
                          fileId: 1,
                          col: 14,
                          length: 5,
                          line: 9,
                        },
                      ],
                      tag: "id",
                      name: "f_$g_$ref",
                    },
                    field: "$deref",
                  },
                  arguments: [
                    {
                      a: [
                        { tag: "number" },
                        {
                          fileId: 1,
                          col: 16,
                          length: 2,
                          line: 9,
                        },
                      ],
                      tag: "literal",
                      value: { tag: "num", value: BigInt(10) },
                    },
                  ],
                },
                right: {
                  a: [
                    { tag: "number" },
                    {
                      fileId: 1,
                      col: 22,
                      length: 4,
                      line: 9,
                    },
                  ],
                  tag: "call_expr",
                  name: {
                    a: [
                      {
                        tag: "callable",
                        args: [{ name: "y", type: { tag: "number" } }],
                        ret: { tag: "number" },
                        isVar: false,
                      },
                      {
                        fileId: 1,
                        col: 22,
                        length: 4,
                        line: 9,
                      },
                    ],
                    tag: "lookup",
                    obj: {
                      a: [
                        { tag: "class", name: "$ref" },
                        {
                          fileId: 1,
                          col: 22,
                          length: 4,
                          line: 9,
                        },
                      ],
                      tag: "id",
                      name: "f_$g_$ref",
                    },
                    field: "$deref",
                  },
                  arguments: [
                    {
                      a: [
                        { tag: "number" },
                        {
                          fileId: 1,
                          col: 24,
                          length: 1,
                          line: 9,
                        },
                      ],
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
          a: [
            { tag: "none" },
            {
              fileId: 1,
              col: 7,
              length: 47,
              line: 3,
            },
          ],
          name: "f_$g",
          parameters: [{ name: "y", type: { tag: "number" } }],
          ret: { tag: "number" },
          nonlocals: ["x", "f_$h"],
          nested: [],
          inits: [],
          isGlobal: false,
          body: [
            {
              a: [
                { tag: "number" },
                {
                  fileId: 1,
                  col: 16,
                  length: 8,
                  line: 4,
                },
              ],
              tag: "return",
              value: {
                a: [
                  { tag: "number" },
                  {
                    fileId: 1,
                    col: 16,
                    length: 8,
                    line: 4,
                  },
                ],
                tag: "binop",
                op: BinOp.Plus,
                left: {
                  a: [
                    { tag: "number" },
                    {
                      fileId: 1,
                      col: 16,
                      length: 1,
                      line: 4,
                    },
                  ],
                  tag: "lookup",
                  obj: {
                    a: [
                      { tag: "class", name: "$ref" },
                      {
                        fileId: 1,
                        col: 16,
                        length: 1,
                        line: 4,
                      },
                    ],
                    tag: "id",
                    name: "x_$ref",
                  },
                  field: "$deref",
                },
                right: {
                  a: [
                    { tag: "number" },
                    {
                      fileId: 1,
                      col: 20,
                      length: 4,
                      line: 4,
                    },
                  ],
                  tag: "call_expr",
                  name: {
                    a: [
                      {
                        tag: "callable",
                        args: [{ name: "z", type: { tag: "number" } }],
                        ret: { tag: "number" },
                        isVar: false,
                      },
                      {
                        fileId: 1,
                        col: 20,
                        length: 4,
                        line: 4,
                      },
                    ],
                    tag: "lookup",
                    obj: {
                      a: [
                        { tag: "class", name: "$ref" },
                        {
                          fileId: 1,
                          col: 20,
                          length: 4,
                          line: 4,
                        },
                      ],
                      tag: "id",
                      name: "f_$h_$ref",
                    },
                    field: "$deref",
                  },
                  arguments: [
                    {
                      a: [
                        { tag: "number" },
                        {
                          fileId: 1,
                          col: 22,
                          length: 1,
                          line: 4,
                        },
                      ],
                      tag: "lookup",
                      obj: {
                        a: [
                          { tag: "class", name: "$ref" },
                          {
                            fileId: 1,
                            col: 22,
                            length: 1,
                            line: 4,
                          },
                        ],
                        tag: "id",
                        name: "y_$ref",
                      },
                      field: "$deref",
                    },
                  ],
                },
              },
            },
          ],
        },
        {
          a: [
            { tag: "none" },
            {
              fileId: 1,
              col: 7,
              length: 77,
              line: 5,
            },
          ],
          name: "f_$h",
          parameters: [{ name: "z", type: { tag: "number" } }],
          ret: { tag: "number" },
          nonlocals: ["x"],
          nested: [],
          inits: [],
          isGlobal: false,
          body: [
            {
              a: [
                { tag: "none" },
                {
                  fileId: 1,
                  col: 9,
                  length: 5,
                  line: 7,
                },
              ],
              tag: "assignment",
              value: {
                a: [
                  { tag: "number" },
                  {
                    fileId: 1,
                    col: 13,
                    length: 1,
                    line: 7,
                  },
                ],
                tag: "lookup",
                obj: {
                  a: [
                    { tag: "class", name: "$ref" },
                    {
                      fileId: 1,
                      col: 13,
                      length: 1,
                      line: 7,
                    },
                  ],
                  tag: "id",
                  name: "z_$ref",
                },
                field: "$deref",
              },
              destruct: {
                valueType: [
                  { tag: "number" },
                  {
                    fileId: 1,
                    col: 9,
                    length: 1,
                    line: 7,
                  },
                ],
                isDestructured: false,
                targets: [
                  {
                    starred: false,
                    ignore: false,
                    target: {
                      a: [
                        { tag: "number" },
                        {
                          fileId: 1,
                          col: 9,
                          length: 1,
                          line: 7,
                        },
                      ],
                      tag: "lookup",
                      obj: {
                        a: [
                          { tag: "class", name: "$ref" },
                          {
                            fileId: 1,
                            col: 9,
                            length: 1,
                            line: 7,
                          },
                        ],
                        tag: "id",
                        name: "x_$ref",
                      },
                      field: "$deref",
                    },
                  },
                ],
              },
            },
            {
              a: [
                { tag: "number" },
                {
                  fileId: 1,
                  col: 16,
                  length: 5,
                  line: 8,
                },
              ],
              tag: "return",
              value: {
                a: [
                  { tag: "number" },
                  {
                    fileId: 1,
                    col: 16,
                    length: 5,
                    line: 8,
                  },
                ],
                tag: "binop",
                op: BinOp.Plus,
                left: {
                  a: [
                    { tag: "number" },
                    {
                      fileId: 1,
                      col: 16,
                      length: 1,
                      line: 8,
                    },
                  ],
                  tag: "lookup",
                  obj: {
                    a: [
                      { tag: "class", name: "$ref" },
                      {
                        fileId: 1,
                        col: 16,
                        length: 1,
                        line: 8,
                      },
                    ],
                    tag: "id",
                    name: "x_$ref",
                  },
                  field: "$deref",
                },
                right: {
                  a: [
                    { tag: "number" },
                    {
                      fileId: 1,
                      col: 20,
                      length: 1,
                      line: 8,
                    },
                  ],
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
