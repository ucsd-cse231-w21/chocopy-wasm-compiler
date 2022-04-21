import * as AST from './ast';
import * as IR from './ir';
import { Type } from './ast';

const nameCounters : Map<string, number> = new Map();
function generateName(base : string) : string {
  if(nameCounters.has(base)) {
    var cur = nameCounters.get(base);
    nameCounters.set(base, cur + 1);
    return base + (cur + 1);
  }
  else {
    nameCounters.set(base, 1);
    return base + 1;
  }
}

function lbl(a: Type, base: string) : [string, IR.Stmt<Type>] {
  const name = generateName(base);
  return [name, {tag: "label", a: a, name: name}];
}

export function lowerProgram(p : AST.Program<Type>) : IR.Program<Type> {
    var [stmtsinits, stmts] = flattenStmts(p.stmts);
    return {
        a: p.a,
        funs: lowerFunDefs(p.funs),
        inits: [...stmtsinits, ...lowerVarInits(p.inits)],
        classes: lowerClasses(p.classes),
        stmts: stmts
    }
}

function lowerFunDefs(fs : Array<AST.FunDef<Type>>) : Array<IR.FunDef<Type>> {
    return fs.map(lowerFunDef).flat();
}

function lowerFunDef(f : AST.FunDef<Type>) : IR.FunDef<Type> {
    var [bodyinits, bodystmts] = flattenStmts(f.body);
    return {...f, inits: [...bodyinits, ...lowerVarInits(f.inits)], body: bodystmts}
}

function lowerVarInits(inits: Array<AST.VarInit<Type>>) : Array<IR.VarInit<Type>> {
    return inits.map(lowerVarInit);
}

function lowerVarInit(init: AST.VarInit<Type>) : IR.VarInit<Type> {
    return {
        ...init,
        value: literalToVal(init.value)
    }
}

function lowerClasses(classes: Array<AST.Class<Type>>) : Array<IR.Class<Type>> {
    return classes.map(lowerClass);
}

function lowerClass(cls: AST.Class<Type>) : IR.Class<Type> {
    return {
        ...cls,
        fields: lowerVarInits(cls.fields),
        methods: lowerFunDefs(cls.methods)
    }
}

function literalToVal(lit: AST.Literal) : IR.Value<Type> {
    switch(lit.tag) {
        case "num":
            return { ...lit, value: BigInt(lit.value) }
        case "bool":
            return lit
        case "none":
            return lit        
    }
}

function flattenStmts(s : Array<AST.Stmt<Type>>) : [Array<IR.VarInit<Type>>, Array<IR.Stmt<Type>>] {
  var loweredStmts = s.map(flattenStmt);
  var inits = loweredStmts.map((pair) => pair[0]).flat();
  var stmts = loweredStmts.map((pair) => pair[1]).flat();
  return [inits, stmts];
}

function flattenStmt(s : AST.Stmt<Type>) : [Array<IR.VarInit<Type>>, Array<IR.Stmt<Type>>] {
  switch(s.tag) {
    case "assign":
      var [valinits, valstmts, vale] = flattenExprToExpr(s.value);
      return [valinits, [
        ...valstmts,
        { a: s.a, tag: "assign", name: s.name, value: vale}
      ]];

    case "return":
    var [valinits, valstmts, val] = flattenExprToVal(s.value);
    return [valinits, [
        ...valstmts,
        {tag: "return", a: s.a, value: val}
    ]];
  
    case "expr":
      var [inits, stmts, e] = flattenExprToExpr(s.expr);
      return [inits, [ ...stmts, {tag: "expr", a: s.a, expr: e } ]];

    case "pass":
      return [[],[]];

    case "field-assign":
      var [oinits, ostmts, oval] = flattenExprToVal(s.obj);
      var [ninits, nstmts, nval] = flattenExprToVal(s.value);
      return [[...oinits, ...ninits], [...ostmts, ...nstmts, {
        tag: "field-assign",
        a: s.a,
        obj: oval,
        field: s.field,
        value: nval
      }]];

    case "if":
      var [cinits, cstmts, cexpr] = flattenExprToExpr(s.cond);
      var [theninits, thenstmts] = flattenStmts(s.thn);
      var [elseinits, elsestmts] = flattenStmts(s.els);
      var [start, startlbl] = lbl(s.a, "start");
      var [end, endlbl] = lbl(s.a, "ifend");
      var [els, elslbl] = lbl(s.a, "elif");
      var condjmp : IR.Stmt<Type> = { tag: "ifjmp", cond: cexpr, thn: start, els: els };
      var endjmp : IR.Stmt<Type> = { tag: "jmp", lbl: end };
      return [[...cinits, ...theninits, ...elseinits], [
        ...cstmts, 
        condjmp,
        startlbl,
        ...thenstmts,
        endjmp,
        elslbl,
        ...elsestmts,
        endjmp,
        endlbl,
      ]];
    
    case "while":
      var [cinits, cstmts, cexpr] = flattenExprToExpr(s.cond);
      var [bodyinits, bodystmts] = flattenStmts(s.body);
      var [start, startlbl] = lbl(s.a, "whilestart");
      var [end, endlbl] = lbl(s.a, "whileend");
      var condjmp : IR.Stmt<Type> = { tag: "ifjmp", cond: cexpr, thn: start, els: end };
      var startjmp : IR.Stmt<Type> = { tag: "jmp", lbl: start };
      return [[...cinits, ...bodyinits], [
        startlbl,
        ...cstmts,
        condjmp,
        ...bodystmts,
        endlbl
      ]]
  }
}

function flattenExprToExpr(e : AST.Expr<Type>) : [Array<IR.VarInit<Type>>, Array<IR.Stmt<Type>>, IR.Expr<Type>] {
  switch(e.tag) {
    case "uniop":
      var [inits, stmts, val] = flattenExprToVal(e.expr);
      return [inits, stmts, {
        ...e,
        expr: val
      }];
    case "binop":
      var [linits, lstmts, lval] = flattenExprToVal(e.left);
      var [rinits, rstmts, rval] = flattenExprToVal(e.right);
      return [[...linits, ...rinits], [...lstmts, ...rstmts], {
          ...e,
          left: lval,
          right: rval
        }];
    case "builtin1":
      var [inits, stmts, val] = flattenExprToVal(e.arg);
      return [inits, stmts, {tag: "builtin1", a: e.a, name: e.name, arg: val}];
    case "builtin2":
      var [linits, lstmts, lval] = flattenExprToVal(e.left);
      var [rinits, rstmts, rval] = flattenExprToVal(e.right);
      return [[...linits, ...rinits], [...lstmts, ...rstmts], {
          ...e,
          left: lval,
          right: rval
        }];
    case "call":
      const callpairs = e.arguments.map(flattenExprToVal);
      const callinits = callpairs.map(cp => cp[0]).flat();
      const callstmts = callpairs.map(cp => cp[1]).flat();
      const callvals = callpairs.map(cp => cp[2]).flat();
      return [ callinits, callstmts,
        {
          ...e,
          arguments: callvals
        }
      ];
    case "method-call":
      const [objinits, objstmts, objval] = flattenExprToVal(e.obj);
      const methpairs = e.arguments.map(flattenExprToVal);
      const methinits = methpairs.map(cp => cp[0]).flat();
      const methstmts = methpairs.map(cp => cp[1]).flat();
      const methvals = methpairs.map(cp => cp[2]).flat();
      return [[...objinits, ...methinits], [...objstmts, ...methstmts], { ...e, obj: objval, arguments: methvals } ];
    case "lookup":
      const [oinits, ostmts, oval] = flattenExprToVal(e.obj);
      return [oinits, ostmts, { ...e, obj: oval, } ];
    case "construct":
      return [[], [], { ...e } ];
    case "id":
      return [[], [], {tag: "value", value: { ...e }} ];
    case "literal":
      return [[], [], {tag: "value", value: literalToVal(e.value) } ];
  }
}

function flattenExprToVal(e : AST.Expr<Type>) : [Array<IR.VarInit<Type>>, Array<IR.Stmt<Type>>, IR.Value<Type>] {
  console.log(e);
  var [binits, bstmts, bexpr] = flattenExprToExpr(e);
  if(bexpr.tag === "value") {
    return [binits, bstmts, bexpr.value];
  }
  else {
    var newName = generateName("valname");
    var setNewName : IR.Stmt<Type> = {
      tag: "assign",
      a: e.a,
      name: newName,
      value: bexpr 
    };
    // TODO: we have to add a new var init for the new variable we're creating here.
    // but what should the default value be?
    return [
      [...binits, { a: e.a, name: newName, type: e.a, value: { tag: "none" } }],
      [...bstmts, setNewName],  
      {tag: "id", name: newName, a: e.a}
    ];
  }
}