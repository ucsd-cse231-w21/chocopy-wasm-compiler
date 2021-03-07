import { Stmt, Expr, UniOp, BinOp, Type, Program, Literal, FunDef, VarInit, Class } from "./ast";
import { NUM, BOOL, NONE, unhandledTag, unreachable } from "./utils";
import * as BaseException from "./error";
import { OrganizedModule } from "./types";
import { BuiltInModule } from "./builtins/builtins";
import { type } from "cypress/types/jquery";

export type LabeledComps = {
  classes : Map<string, number>,
  funcs: Map<string, CallSite>, //maps function signatures to function labels
  globalVars: Map<string, number> // maps global variables to their indices
}

export type CallSite = 
{tag: "external", level: string, label: string} | 
{tag: "local", label: string}

export type IdenType = 
{tag: "localvar"} |
{tag: "globalvar", index: number} |
{tag: "module", originalName: string} 

const INTANCTIATE = "1nstanciate";
const GLOBAL_REF = "2ref";
const GLOBAL_STORE = "3store";
const OBJ_DEREF = "4objref";
const OBJ_MUTATE = "5mutate";
const ALLOC_PRIM = "6prim"; //first argument (1 for bool, 2 for int), second argument is the value
const TEMP_VAR = "1emp"; //used for returning values at the end of functions


function lookup(name: string, maps: Array<Map<string, IdenType>>) : IdenType {
  for(let m of maps){
    const found = m.get(name);
    if(found !== undefined){
      return found;
    }
  }
  return undefined;
}

export function compile(progam: OrganizedModule, builtins: Map<string, BuiltInModule>, labels: LabeledComps) : Array<string> {
  const allInstrs = new Array<string>();

  //account for import statements first
  const topLvlIdens = new Map<string, IdenType>();
  for(let i of progam.imports){
    if(i.tag === "import"){
      if(i.isFromStmt){

      }
      else{
        topLvlIdens.set(i.alias === undefined ? 
                          i.target : 
                          i.alias, {tag: "module", originalName: i.target});
      }
    }
  }
  
  //now, add on global variables
  for(let vName of progam.fileVars.keys()){

  }

  return undefined;
}


function codeGenStmt(stmt: Stmt<Type>, idens: Array<Map<string, IdenType>>, labels: LabeledComps): Array<string> {
  switch (stmt.tag) {
    case "assign":{
      const result = lookup(stmt.name, idens);
      if(result === undefined){
        //this should be a fatal error. 
        //Type checking should have caught this
        throw new Error(`Unfound identifier ${stmt.name}`);
      }
      else {
        const valueInstr = codeGenExpr(stmt.value, idens, labels);

        if(result.tag === "localvar"){
          return [`(local.set $${stmt.tag} ${valueInstr})`];
        }
        else if(result.tag === "globalvar"){
          return [`(call $${GLOBAL_STORE} (i32.const ${result.index}) ${valueInstr})`];
        }
        else{
          //this shouldn't happen as type checking wouldn't allow it
          throw new Error(`Fatal error at re-assigning an import statement ${JSON.stringify(stmt)}`);
        }
      }
      break;
    }
    case "return":{
      return [`(local.set $${TEMP_VAR} ${codeGenExpr(stmt.value, idens, labels)})`];
    }
    case "expr": {
      return [codeGenExpr(stmt.expr, idens, labels), "(drop)"];
    }
    case "if": {
      const condInstrs = codeGenExpr(stmt.cond, idens, labels);
      const thenBranch = stmt.thn.map(x => codeGenStmt(x, idens, labels));
      const elseBranch = stmt.els.map(x => codeGenStmt(x, idens, labels));

      return [`(if ${condInstrs} (then ${thenBranch.join("\n")}) (else ${elseBranch.join("\n")}) )`];
    }
    case "pass": {
      return [];
    }
    case "field-assign": {
      const objInstrs = codeGenExpr(stmt.obj, idens, labels);

    }
    case "while-loop":

    default: throw new Error(`Unsupported statement type ${stmt.tag}`);

    /*
    case "if":
      var condExpr = codeGenExpr(stmt.cond, env);
      var thnStmts = stmt.thn.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      var elsStmts = stmt.els.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      return [
        `${condExpr.join("\n")} \n (if (then ${thnStmts.join("\n")}) (else ${elsStmts.join(
          "\n"
        )}))`,
      ];
    case "while":
      var wcondExpr = codeGenExpr(stmt.cond, env);
      var bodyStmts = stmt.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      return [`(block (loop  ${bodyStmts.join("\n")} (br_if 0 ${wcondExpr.join("\n")}) (br 1) ))`];
    case "pass":
      return [];
    case "field-assign":
      var objStmts = codeGenExpr(stmt.obj, env);
      var objTyp = stmt.obj.a;
      if (objTyp.tag !== "class") {
        // I don't think this error can happen
        throw new Error(
          "Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag
        );
      }
      var className = objTyp.name;
      var [offset, _] = env.classes.get(className).get(stmt.field);
      var valStmts = codeGenExpr(stmt.value, env);
      return [...objStmts, `(i32.add (i32.const ${offset * 4}))`, ...valStmts, `(i32.store)`];
    default:
      unhandledTag(stmt);
      */
  }
}

function codeGenExpr(expr: Expr, idens: Array<Map<string, IdenType>>, labels: LabeledComps): string {
  
}

function codeGenInit(init: VarInit<Type>, env: GlobalEnv): Array<string> {
  const value = codeGenLiteral(init.value, env);
  if (env.locals.has(init.name)) {
    return [...value, `(local.set $${init.name})`];
  } else {
    const locationToStore = [`(i32.const ${envLookup(env, init.name)}) ;; ${init.name}`];
    return locationToStore.concat(value).concat([`(i32.store)`]);
  }
}

function codeGenDef(def: FunDef<Type>, env: GlobalEnv): Array<string> {
  var definedVars: Set<string> = new Set();
  def.inits.forEach((v) => definedVars.add(v.name));
  definedVars.add("$last");
  // def.parameters.forEach(p => definedVars.delete(p.name));
  definedVars.forEach(env.locals.add, env.locals);
  def.parameters.forEach((p) => env.locals.add(p.name));

  const localDefines = makeLocals(definedVars);
  const locals = localDefines.join("\n");
  const inits = def.inits
    .map((init) => codeGenInit(init, env))
    .flat()
    .join("\n");
  var params = def.parameters.map((p) => `(param $${p.name} i32)`).join(" ");
  var stmts = def.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
  var stmtsBody = stmts.join("\n");
  env.locals.clear();
  return [
    `(func $${def.name} ${params} (result i32)
    ${locals}
    ${inits}
    ${stmtsBody}
    (i32.const 0)
    (return))`,
  ];
}

function codeGenClass(cls: Class<Type>, env: GlobalEnv): Array<string> {
  const methods = [...cls.methods];
  methods.forEach((method) => (method.name = `${cls.name}$${method.name}`));
  const result = methods.map((method) => codeGenDef(method, env));
  return result.flat();
}

function codeGenExpr(expr: Expr<Type>, env: GlobalEnv): Array<string> {
  switch (expr.tag) {
    case "builtin1":
      const argTyp = expr.a;
      const argStmts = codeGenExpr(expr.arg, env);
      var callName = expr.name;
      if (expr.name === "print" && argTyp === NUM) {
        callName = "print_num";
      } else if (expr.name === "print" && argTyp === BOOL) {
        callName = "print_bool";
      } else if (expr.name === "print" && argTyp === NONE) {
        callName = "print_none";
      }
      return argStmts.concat([`(call $${callName})`]);
    case "builtin2":
      const leftStmts = codeGenExpr(expr.left, env);
      const rightStmts = codeGenExpr(expr.right, env);
      return [...leftStmts, ...rightStmts, `(call $${expr.name})`];
    case "literal":
      return codeGenLiteral(expr.value, env);
    case "id":
      if (env.locals.has(expr.name)) {
        return [`(local.get $${expr.name})`];
      } else {
        return [`(i32.const ${envLookup(env, expr.name)})`, `(i32.load)`];
      }
    case "binop":
      const lhsStmts = codeGenExpr(expr.left, env);
      const rhsStmts = codeGenExpr(expr.right, env);
      return [...lhsStmts, ...rhsStmts, codeGenBinOp(expr.op)];
    case "uniop":
      const exprStmts = codeGenExpr(expr.expr, env);
      switch (expr.op) {
        case UniOp.Neg:
          return [`(i32.const 0)`, ...exprStmts, `(i32.sub)`];
        case UniOp.Not:
          return [`(i32.const 0)`, ...exprStmts, `(i32.eq)`];
        default:
          return unreachable(expr);
      }
    case "call":
      var valStmts = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
      valStmts.push(`(call $${expr.name})`);
      return valStmts;
    case "construct":
      var stmts: Array<string> = [];
      env.classes.get(expr.name).forEach(([offset, initVal], field) =>
        stmts.push(
          ...[
            `(i32.load (i32.const 0))`, // Load the dynamic heap head offset
            `(i32.add (i32.const ${offset * 4}))`, // Calc field offset from heap offset
            ...codeGenLiteral(initVal, env), // Initialize field
            "(i32.store)", // Put the default field value on the heap
          ]
        )
      );
      return stmts.concat([
        "(i32.load (i32.const 0))", // Get address for the object (this is the return value)
        "(i32.load (i32.const 0))", // Get address for the object (this is the return value)
        "(i32.const 0)", // Address for our upcoming store instruction
        "(i32.load (i32.const 0))", // Load the dynamic heap head offset
        `(i32.add (i32.const ${env.classes.get(expr.name).size * 4}))`, // Move heap head beyond the two words we just created for fields
        "(i32.store)", // Save the new heap offset
        `(call $${expr.name}$__init__)`, // call __init__
        "(drop)",
      ]);
    case "method-call":
      if(expr.obj.tag === "id"){
        //check if the ID is an imported module
        if(env.imports.has(expr.obj.name)){
          return [`(call $${expr.method})`];
        }
      }

      var objStmts = codeGenExpr(expr.obj, env);
      var objTyp = expr.obj.a;
      if (objTyp.tag !== "class") {
        // I don't think this error can happen
        throw new Error(
          "Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag
        );
      }
      var className = objTyp.name;
      var argsStmts = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
      return [...objStmts, ...argsStmts, `(call $${className}$${expr.method})`];
    case "lookup":
      var objStmts = codeGenExpr(expr.obj, env);
      var objTyp = expr.obj.a;
      if (objTyp.tag !== "class") {
        // I don't think this error can happen
        throw new Error(
          "Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag
        );
      }
      var className = objTyp.name;
      var [offset, _] = env.classes.get(className).get(expr.field);
      return [...objStmts, `(i32.add (i32.const ${offset * 4}))`, `(i32.load)`];
    default:
      unhandledTag(expr);
  }
}

function codeGenLiteral(literal: Literal, env: GlobalEnv): Array<string> {
  switch (literal.tag) {
    case "num":
      return ["(i32.const " + literal.value + ")"];
    case "bool":
      return [`(i32.const ${Number(literal.value)})`];
    case "none":
      return [`(i32.const 0)`];
    default:
      unhandledTag(literal);
  }
}

function codeGenBinOp(op: BinOp): string {
  switch (op) {
    case BinOp.Plus:
      return "(i32.add)";
    case BinOp.Minus:
      return "(i32.sub)";
    case BinOp.Mul:
      return "(i32.mul)";
    case BinOp.IDiv:
      return "(i32.div_s)";
    case BinOp.Mod:
      return "(i32.rem_s)";
    case BinOp.Eq:
      return "(i32.eq)";
    case BinOp.Neq:
      return "(i32.ne)";
    case BinOp.Lte:
      return "(i32.le_s)";
    case BinOp.Gte:
      return "(i32.ge_s)";
    case BinOp.Lt:
      return "(i32.lt_s)";
    case BinOp.Gt:
      return "(i32.gt_s)";
    case BinOp.Is:
      return "(i32.eq)";
    case BinOp.And:
      return "(i32.and)";
    case BinOp.Or:
      return "(i32.or)";
  }
}
