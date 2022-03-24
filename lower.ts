import * as AST from './ast';
import * as IR from './ir';

const nameCounters : Map<string, number> = new Map();
function generateName(base : string) : string {
  if(nameCounters.has(base)) {
    var cur = nameCounters.get(base);
    nameCounters.set(base, cur + 1);
    return base + cur;
  }
  else {
    nameCounters.set(base, 1);
    return base + 1;
  }
}

function lbl<A>(a: A, base: string) : [string, IR.Stmt<A>] {
  const name = generateName(base);
  return [name, {tag: "label", a: a, name: name}];
}

export function lowerProgram<A>(p : AST.Program<A>) : IR.Program<A> {
    return {
        a: p.a,
        funs: lowerFunDefs(p.funs),
        inits: lowerVarInits(p.inits),
        classes: lowerClasses(p.classes),
        stmts: flattenStmts(p.stmts)
    }
}

function lowerFunDefs<A>(fs : Array<AST.FunDef<A>>) : Array<IR.FunDef<A>> {
    return fs.map(lowerFunDef).flat();
}

function lowerFunDef<A>(f : AST.FunDef<A>) : IR.FunDef<A> {
    return {...f, inits: lowerVarInits(f.inits), body: flattenStmts(f.body)}
}

function lowerVarInits<A>(inits: Array<AST.VarInit<A>>) : Array<IR.VarInit<A>> {
    return inits.map(lowerVarInit);
}

function lowerVarInit<A>(init: AST.VarInit<A>) : IR.VarInit<A> {
    return {
        ...init,
        value: literalToVal<A>(init.value)
    }
}

function lowerClasses<A>(classes: Array<AST.Class<A>>) : Array<IR.Class<A>> {
    return classes.map(lowerClass);
}

function lowerClass<A>(cls: AST.Class<A>) : IR.Class<A> {
    return {
        ...cls,
        fields: lowerVarInits(cls.fields),
        methods: lowerFunDefs(cls.methods)
    }
}

function literalToVal<A>(lit: AST.Literal) : IR.Value<A> {
    switch(lit.tag) {
        case "num":
            return { ...lit, value: BigInt(lit.value) }
        case "bool":
            return lit
        case "none":
            return lit        
    }
}

function flattenStmts<A>(s : Array<AST.Stmt<A>>) : Array<IR.Stmt<A>> {
  return s.map(flattenStmt).flat();
}

function flattenStmt<A>(s : AST.Stmt<A>) : Array<IR.Stmt<A>> {
  switch(s.tag) {
    case "assign":
      var [valstmts, vale] = flattenExprToExpr(s.value);
      return [
        ...valstmts,
        { a: s.a, tag: "assign", name: s.name, value: vale}
      ];

    case "return":
    var [valstmts, val] = flattenExprToVal(s.value);
    return [
        ...valstmts,
        {tag: "return", a: s.a, value: val}
    ];
  
    case "expr":
      var [stmts, e] = flattenExprToExpr(s.expr);
      return [ ...stmts, {tag: "expr", a: s.a, expr: e } ];

    case "pass":
      return [];

    case "field-assign":
      var [ostmts, oval] = flattenExprToVal(s.obj);
      var [nstmts, nval] = flattenExprToVal(s.value);
      return [...ostmts, ...nstmts, {
        tag: "field-assign",
        a: s.a,
        obj: oval,
        field: s.field,
        value: nval
      }];

    case "if":
      var [cstmts, cexpr] = flattenExprToExpr(s.cond);
      var thenstmts = flattenStmts(s.thn);
      var elsestmts = flattenStmts(s.els);
      var [cstmts, cexpr] = flattenExprToExpr(s.cond);
      var [start, startlbl] = lbl(s.a, "start");
      var [end, endlbl] = lbl(s.a, "ifend");
      var [els, elslbl] = lbl(s.a, "elif");
      var condjmp : IR.Stmt<A> = { tag: "ifjmp", cond: cexpr, thn: start, els: els };
      var endjmp : IR.Stmt<A> = { tag: "jmp", lbl: end };
      return [
        ...cstmts, 
        condjmp,
        startlbl,
        ...thenstmts,
        endjmp,
        elslbl,
        ...elsestmts,
        endjmp,
        endlbl,
      ];
    
    case "while":
      var [cstmts, cexpr] = flattenExprToExpr(s.cond);
      var bodystmts = flattenStmts(s.body);
      var [start, startlbl] = lbl(s.a, "whilestart");
      var [end, endlbl] = lbl(s.a, "whileend");
      var condjmp : IR.Stmt<A> = { tag: "ifjmp", cond: cexpr, thn: start, els: end };
      var startjmp : IR.Stmt<A> = { tag: "jmp", lbl: start };
      return [
        startlbl,
        ...cstmts,
        condjmp,
        ...bodystmts,
        endlbl
      ]
    
  }

}

function flattenExprToExpr<A>(e : AST.Expr<A>) : [Array<IR.Stmt<A>>, IR.Expr<A>] {
  switch(e.tag) {
    case "binop":
      var [lstmts, lval] = flattenExprToVal(e.left);
      var [rstmts, rval] = flattenExprToVal(e.right);
      return [[...lstmts, ...rstmts], {
          ...e,
          left: lval,
          right: rval
        }];
    case "builtin1":
      var [stmts, val] = flattenExprToVal(e.arg);
      return [stmts, {tag: "builtin1", a: e.a, name: e.name, arg: val}];
    case "builtin2":
      var [lstmts, lval] = flattenExprToVal(e.left);
      var [rstmts, rval] = flattenExprToVal(e.right);
      return [[...lstmts, ...rstmts], {
          ...e,
          left: lval,
          right: rval
        }];
    case "call":
      const callpairs = e.arguments.map(flattenExprToVal);
      const callstmts = callpairs.map(cp => cp[0]).flat();
      const callvals = callpairs.map(cp => cp[1]).flat();
      return [callstmts,
        {
          ...e,
          arguments: callvals
        }
      ];
    case "method-call":
      const [objstmts, objval] = flattenExprToVal(e.obj);
      const methpairs = e.arguments.map(flattenExprToVal);
      const methstmts = methpairs.map(cp => cp[0]).flat();
      const methvals = methpairs.map(cp => cp[1]).flat();
      return [[...objstmts, ...methstmts], { ...e, obj: objval, arguments: methvals } ];
    case "lookup":
      const [ostmts, oval] = flattenExprToVal(e.obj);
      return [[...ostmts], { ...e, obj: oval, } ];
    case "construct":
      return [[], { ...e } ];
    case "id":
      return [[], {tag: "value", value: { ...e }} ];
    case "literal":
      return [[], {tag: "value", value: literalToVal(e.value) } ];
  }
}

function flattenExprToVal<A>(e : AST.Expr<A>) : [Array<IR.Stmt<A>>, IR.Value<A>] {
  var [bstmts, bexpr] = flattenExprToExpr(e);
  if(bexpr.tag === "value") {
    return [bstmts, bexpr.value];
  }
  else {
    var newName = generateName("valname");
    var setNewName : IR.Stmt<A> = {
      tag: "assign",
      a: e.a,
      name: newName,
      value: bexpr 
    };
    return [[...bstmts, setNewName], {tag: "id", name: newName}];
  }
}