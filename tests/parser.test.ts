import * as mocha from 'mocha';
import {expect} from 'chai';
import { parser } from 'lezer-python';
import { UniOp, BinOp } from "../ast";
import { traverseExpr, traverseStmt, traverse, parse } from '../parser';

// We write tests for each function in parser.ts here. Each function gets its
// own describe statement. Each it statement represents a single test. You
// should write enough unit tests for each function until you are confident
// the parser works as expected.
describe('traverseExpr(c, s) function', () => {
  it('parses a number in the beginning', () => {
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
        value: BigInt(987)
      }
    });
  })

  // TODO: add additional tests here to ensure traverseExpr works as expected
  it('parses None in the beginning', () => {
    const source = "None";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();
    const parsedExpr = traverseExpr(cursor, source);

    expect(parsedExpr).to.deep.equal({
      tag: "literal",
      value: { tag: "none" }
    });
  });

  it('parses a uniop', () => {
    const source = "not True";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();
    const parsedExpr = traverseExpr(cursor, source);

    expect(parsedExpr).to.deep.equal({
      tag: "uniop",
      op: UniOp.Not,
      expr: { tag: "literal", value: { tag: "bool", value: true } }
    });
  });

  it('parses a binop', () => {
    const source = "7 - 3";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();
    const parsedExpr = traverseExpr(cursor, source);

    expect(parsedExpr).to.deep.equal({
      tag: "binop",
      op: BinOp.Minus,
      left: { tag: "literal", value: { tag: "num", value: BigInt(7) } },
      right: { tag: "literal", value: { tag: "num", value: BigInt(3) } }
    });
  });

  it('parses a list', () => {
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
        { tag: "literal", value: { tag: "num", value: BigInt(3) } }
      ]
    });
  });

//| { a?: A; tag: "bracket-lookup"; obj: Expr<A>; key: Expr<A> };
  it('parses a list lookup', () => {
    const source = "items[6]";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();
    const parsedExpr = traverseExpr(cursor, source);

    expect(parsedExpr).to.deep.equal({
      tag: "bracket-lookup",
      obj: { tag: "id", name: "items" },
      key: { tag: "literal", value: { tag: "num", value: BigInt(6) } }
    });
  });
});

describe('traverseStmt(c, s) function', () => {
  // TODO: add tests here to ensure traverseStmt works as expected
  it('parses a list-assignment', () => {
    const source = "items[2] = True";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild(); //go to statement
    const parsedStmt = traverseStmt(cursor, source);
    
    expect(parsedStmt).to.deep.equal({
      tag: "bracket-assign",
      obj: { tag: "id", name: "items" },
      key: { tag: "literal", value: { tag: "num", value: BigInt(2) } },
      value: { tag: "literal", value: { tag: "bool", value: true } }
    });
  });
  
});

/*
describe('traverse(c, s) function', () => {
  // TODO: add tests here to ensure traverse works as expected
});
*/

/*
export type Program<A> = {
  a?: A;
  funs: Array<FunDef<A>>;
  inits: Array<VarInit<A>>;
  classes: Array<Class<A>>;
  stmts: Array<Stmt<A>>;
};
*/
describe('parse(source) function', () => {
  it('parse a number', () => {
    const parsed = parse("987");
    expect(parsed.stmts).to.deep.equal([
      {tag: "expr", expr: {tag: "literal", value: {tag: "num", value: BigInt(987)} } }
    ]);
  });

  // TODO: add additional tests here to ensure parse works as expected
});
