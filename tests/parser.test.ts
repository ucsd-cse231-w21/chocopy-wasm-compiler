import * as mocha from "mocha";
import { expect } from "chai";
import { parser } from "lezer-python";
import { UniOp, BinOp } from "../ast";
import { traverseExpr, traverseStmt, traverse, parse } from "../parser";
import { singleVarAssignment } from "./utils.test";

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
      tag: "uniop",
      op: UniOp.Not,
      expr: { tag: "literal", value: { tag: "bool", value: true } },
    });
  });

  it("parses a binop", () => {
    const source = "7 - 3";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();
    const parsedExpr = traverseExpr(cursor, source);

    expect(parsedExpr).to.deep.equal({
      tag: "binop",
      op: BinOp.Minus,
      left: { tag: "literal", value: { tag: "num", value: BigInt(7) } },
      right: { tag: "literal", value: { tag: "num", value: BigInt(3) } },
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
      contents: [
        { tag: "literal", value: { tag: "num", value: BigInt(1) } },
        { tag: "literal", value: { tag: "num", value: BigInt(2) } },
        { tag: "literal", value: { tag: "num", value: BigInt(3) } },
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
      tag: "bracket-lookup",
      obj: { tag: "id", name: "items" },
      key: { tag: "literal", value: { tag: "num", value: BigInt(6) } },
    });
  });
});

describe("parse(source) function", () => {
  it("parse a typed dict variable initialization", () => {
    const parsed = parse("d:[int, bool] = None");
    expect(parsed.inits).to.deep.equal([
      {
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

  it("parse an empty dict expression", () => {
    const parsed = parse("d = {}");
    expect(parsed.stmts).to.deep.equal([
      singleVarAssignment("d", {
        tag: "dict",
        entries: [],
      }),
    ]);
  });

  it("parse a dict expression", () => {
    const parsed = parse("d = {2:True}");
    expect(parsed.stmts).to.deep.equal([
      singleVarAssignment("d", {
        tag: "dict",
        entries: [
          [
            { tag: "literal", value: { tag: "num", value: 2n } },
            { tag: "literal", value: { tag: "bool", value: true } },
          ],
        ],
      }),
    ]);
  });

  it("parse a nested dict expression", () => {
    const parsed = parse("d = {2:{4:True}}");
    expect(parsed.stmts).to.deep.equal([
      singleVarAssignment("d", {
        tag: "dict",
        entries: [
          [
            { tag: "literal", value: { tag: "num", value: 2n } },
            {
              tag: "dict",
              entries: [
                [
                  { tag: "literal", value: { tag: "num", value: 4n } },
                  { tag: "literal", value: { tag: "bool", value: true } },
                ],
              ],
            },
          ],
        ],
      }),
    ]);
  });

  it("parse a bracket-lookup expression", () => {
    const parsed = parse("x = d[2]");
    expect(parsed.stmts).to.deep.equal([
      singleVarAssignment("x", {
        tag: "bracket-lookup",
        obj: { tag: "id", name: "d" },
        key: { tag: "literal", value: { tag: "num", value: 2n } },
      }),
    ]);
  });

  it("parse a number", () => {
    const parsed = parse("987");
    expect(parsed.stmts).to.deep.equal([
      { tag: "expr", expr: { tag: "literal", value: { tag: "num", value: BigInt(987) } } },
    ]);
  });
});
