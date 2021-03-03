import * as mocha from 'mocha';
import {expect} from 'chai';
import { parser } from 'lezer-python';
import { traverseExpr, traverseStmt, traverse, parse } from '../parser';
import { BinOp } from '../ast';

// We write tests for each function in parser.ts here. Each function gets its
// own describe statement. Each it statement represents a single test. You
// should write enough unit tests for each function until you are confident
// the parser works as expected.
// describe('traverseExpr(c, s) function', () => {
//   it('parses a number in the beginning', () => {
//     const source = "987";
//     const cursor = parser.parse(source).cursor();

//     // go to statement
//     cursor.firstChild();
//     // go to expression
//     cursor.firstChild();

//     const parsedExpr = traverseExpr(cursor, source);

//     // Note: we have to use deep equality when comparing objects
//     expect(parsedExpr).to.deep.equal({tag: "num", value: 987});
//   })

  // TODO: add additional tests here to ensure traverseExpr works as expected
// });

describe('traverseStmt(c, s) function', () => {
  // TODO: add tests here to ensure traverseStmt works as expected
});

describe('traverse(c, s) function', () => {
  // TODO: add tests here to ensure traverse works as expected
});

// describe('parse(source) function', () => {
//   it('parse a number', () => {
//     const parsed = parse("987");
//     expect(parsed.stmts).to.deep.equal([{tag: "expr", expr: {tag : "literal", value: {tag: "num", value: 987}}}]);
//   });

//   // TODO: add additional tests here to ensure parse works as expected

// });

describe('parse(source) function', () => {
    it('parse a Callable[[], None] type initialization', () => {
      const parsed = parse("f:Callable[[], None] = None");
      expect(parsed.inits).to.deep.equal([
        {
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
    it('parse a Callable[[int], bool] type initialization', () => {
        const parsed = parse("f:Callable[[int], bool] = None");
        expect(parsed.inits).to.deep.equal([
          {
            name: "f",
            type: {
              tag: "callable",
              args: [{tag: "number"}],
              ret: { tag: "bool" },
            }, //end of type
            value: { tag: "none" },
          },
        ]);   
    });
        
    it('parse a Callable[[int, bool], Foo] type initialization', () => {
        const parsed = parse("f:Callable[[int, bool], Foo] = None");
        expect(parsed.inits).to.deep.equal([
          {
            name: "f",
            type: {
              tag: "callable",
              args: [{tag: "number"}, {tag: "bool"}],
              ret: { tag: "class" , name: "Foo" },
            }, //end of type
            value: { tag: "none" },
          },
        ]); 
    });

    it('parse a nested function', () => {
        const parsed = parse(`
            def f(x: int) -> int:
                def g() -> int:
                    return x
                return g()
        `);
        expect(parsed.funs).to.deep.equal([
           {
            name: "f",
            parameters: [{name: "x", type: {tag: "number"},}],
            ret: {tag: "number"},
            decls: [],
            inits: [],
            funs: [{    name: "g",
                        parameters: [],
                        ret: {tag: "number"},
                        decls: [],
                        inits: [],
                        funs: [],
                        body: [{tag: "return", value: {tag: "id", name: "x"}}]
                    }],
            body: [{tag: "return", value: {tag: "call", name: "g", arguments: []}}]
          },
        ]);    
    });

    it('parse a nested function with nonlocal', () => {
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
            name: "f",
            parameters: [{name: "x", type: {tag: "number"},}],
            ret: {tag: "callable", args: [], ret: {tag: "bool"}},
            decls: [],
            inits: [],
            funs: [ {   name: "k",
                        parameters: [],
                        ret: {tag: "none"},
                        decls: [],
                        inits: [],
                        funs: [],
                        body: [{tag: "pass"}]
                    }, 
                    {   name: "g",
                        parameters: [],
                        ret: {tag: "bool"},
                        decls: [{tag: "nonlocal", name: "x"}],
                        inits: [],
                        funs: [],
                        body: [{tag: "return", value: {tag: "literal", value: {tag: "bool", value: true}}}]
                    }],
            body: [{tag: "return", value: {tag: "id", name: "g"}}]
          },
        ]); 
    });

    it('parse a function call with callable return type', () => {
        const parsed = parse(`id(f())(5)`);
        expect(parsed.stmts).to.deep.equal([
          {
            tag: "expr", 
            expr:   {
                        tag: "call_expr", 
                        name: {tag: "call", name: "id", arguments: [{tag: "call", name: "f", arguments: []}]}, 
                        arguments: [{tag: "literal", value: {tag: "num", value: 5n}}]
                    }
          }
        ])
    });

    it('parse a method call with callable return type', () => {
        const parsed = parse(`a.id()(5)`);
        expect(parsed.stmts).to.deep.equal([
          {
            tag: "expr", 
            expr:   {
                        tag: "call_expr", 
                        name: {tag: "method-call", obj: {tag: "id", name: "a"}, method: "id", arguments: []}, 
                        arguments: [{tag: "literal", value: {tag: "num", value: 5n}}]
                    }
          }
        ])
    });

    it('parse a lambda expression (no arg)', () => {
        const parsed = parse(`lambda a : a + 10`);
        expect(parsed.stmts).to.deep.equal([
          {
            tag: "expr", 
            expr: {
                    tag: "lambda", 
                    args: ["a"], 
                    ret: { 
                            tag: "binop", 
                            op: BinOp.Plus, 
                            left: {tag: "id", name: "a"},
                            right: {tag: "literal", value: {tag: "num", value: 10n}} 
                          }
                  }
          }
        ])
    });

    it('parse a lambda expression (multiple arg)', () => {
        const parsed = parse(`lambda a, b, c : 10`);
        expect(parsed.stmts).to.deep.equal([
          {
            tag: "expr", 
            expr: {
                    tag: "lambda", 
                    args: ["a", "b", "c"], 
                    ret: { tag: "literal", value: {tag: "num", value: 10n}} 
                  }
          }
        ])
    });

});
