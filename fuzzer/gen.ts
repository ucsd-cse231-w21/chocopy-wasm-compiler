import { DEFAULT_MAX_VERSION } from "tls";
import { forEachChild } from "typescript";
import { Parameter, VarInit, Type } from "../ast";

const indent: string = "  ";

type FunDef<A> = {
  a?: A;
  name: string;
  parameters: Array<Parameter<A>>;
  ret: Type;
};

type ProbPair = {
  prob: number;
  key: string;
};

type Program = {
  program: Array<string>;
  stmt: string;
};

class Env {
  vars: Map<Type, Array<string>>;
  funcs: Map<Type, Array<FunDef<any>>>;

  constructor() {
    this.vars = new Map();
    this.funcs = new Map();
  }

  addVar(name: string, type: Type) {
    this.vars.get(type).push(name);
  }

  delVar(varName: string) {
    this.vars.forEach((names: Array<string>, type: Type) => {
      this.vars.set(
        type,
        names.filter(function (name) {
          return name !== varName;
        })
      );
    });
  }

  addFunc() {}

  copyEnv(): Env {
    var newEnv = new Env();
    newEnv.vars = new Map(this.vars);
    newEnv.funcs = new Map(this.funcs);
    return newEnv;
  }
}
//constants
const BODY_STMT_CHANCE = 0.5;
const IF_ELIF_CHANCE = 0.2;
const IF_ELSE_CHANCE = 0.5;
const PARAM_CHANCE = 0.5;

var StmtProbs: Array<ProbPair>;
var ExprProbs: Array<ProbPair>;
var numberLiteralProbs: Array<ProbPair>;
var boolLiteralProbs: Array<ProbPair>;
var classLiteralProbs: Array<ProbPair>;
var numberBinopProbs: Array<ProbPair>;
var boolBinopProbs: Array<ProbPair>;
var TypeProbs: Array<ProbPair>;

var CorrectProbs: Array<ProbPair>; // probability of generating something correct

const initTypeProbs = [
  { key: "number", prob: 0.6 },
  { key: "bool", prob: 0.9 },
  { key: "none", prob: 1 },
];

const initCorrectProbs = [
  { key: "correct", prob: 1 },
  { key: "incorrect", prob: 1 }, //start by generating only correct statements
];

const initStmtProbs = [
  { key: "expr", prob: 0.7 },
  { key: "if", prob: 0.9 },
  { key: "assign", prob: 1 },
  { key: "return", prob: 1 },
  { key: "while", prob: 1 },
  { key: "pass", prob: 1 },
  { key: "field-assign", prob: 1 },
];

const initExprProbs = [
  { key: "literal", prob: 0.5 },
  { key: "id", prob: 0.5 },
  { key: "binop", prob: 0.9 },
  { key: "uniop", prob: 1 },
  { key: "builtin1", prob: 1 },
  { key: "builtin2", prob: 1 },
  { key: "call", prob: 1 },
  { key: "lookup", prob: 1 },
  { key: "method-call", prob: 1 },
  { key: "construct", prob: 1 },
];

const initNumberLiteralProbs = [
  { key: "0", prob: 0 },
  { key: "1", prob: 1 },
];

const initBoolLiteralProbs = [
  { key: "True", prob: 0.5 },
  { key: "False", prob: 1 },
];

const initNumberBinopProbs = [
  { key: "Plus", prob: 0.2 },
  { key: "Minus", prob: 0.4 },
  { key: "Mul", prob: 0.6 },
  { key: "IDiv", prob: 0.8 },
  { key: "Mod", prob: 1 },
];

const initBoolBinopProbs = [
  { key: "Eq", prob: 0.1 },
  { key: "Neq", prob: 0.2 },
  { key: "Lte", prob: 0.3 },
  { key: "Gte", prob: 0.4 },
  { key: "Lt", prob: 0.5 },
  { key: "Gt", prob: 0.8 },
  { key: "Is", prob: 0.7 },
  { key: "And", prob: 0.8 },
  { key: "Or", prob: 1 },
];

function initDefaultProbs() {
  StmtProbs = [...initStmtProbs];
  ExprProbs = [...initExprProbs];
  numberLiteralProbs = [...initNumberLiteralProbs];
  boolLiteralProbs = [...initBoolLiteralProbs];
  TypeProbs = [...initTypeProbs];
  CorrectProbs = [...initCorrectProbs];
  numberBinopProbs = [...initNumberBinopProbs];
  boolBinopProbs = [...initBoolBinopProbs];
}

function convertTypeFromKey(key: string): Type {
  switch (key) {
    case "number":
      return { tag: "number" };
    case "bool":
      return { tag: "bool" };
    case "none":
      return { tag: "none" };
    default:
      throw new Error(`Unknown type from key: ${key}`);
  }
}

function selectKey(probTable: Array<ProbPair>): string {
  const prob = Math.random();
  let selection = "";
  for (var i = 0; i < probTable.length; i++) {
    if (prob <= probTable[i].prob) {
      selection = probTable[i].key;
      break;
    }
  }
  if (selection == "") throw new Error("selection was never assigned");
  return selection;
}

function selectRandomExpr(type: Type): string {
  return selectKey(ExprProbs);
}

function selectRandomLiteral(type: Type): string {
  switch (type.tag) {
    case "number":
      return selectKey(numberLiteralProbs);
    case "bool":
      return selectKey(boolLiteralProbs);
    case "none":
      return "None";
    default:
      throw new Error(`Unknown type from selectRandomLiteral: ${type}`);
  }
}

function selectRandomBinOp(type: Type): string {
  switch (type.tag) {
    case "number":
      return selectKey(numberBinopProbs);
    case "bool":
      return selectKey(boolBinopProbs);
    case "none":
      return "Is"; // TODO probabilities
    default:
      throw new Error(`Unknown type from selectRandomBinOp: ${type.tag}`);
  }
}

function selectRandomUniOp(type: Type): string {
  switch (type.tag) {
    case "number":
      return "Neg";
    case "bool":
      return "Not";
    case "none":
      return "";
    default:
      throw new Error(`Unknown type from selectRandomUniOp: ${type.tag}`);
  }
}

function selectRandomType(): Type {
  return convertTypeFromKey(selectKey(TypeProbs));
}

function selectRandomStmt(): string {
  return selectKey(StmtProbs);
}

function genClassDef(level: number, env: Env): Array<string> {
  return []; //TODO
}

function genFuncName(env: Env, retType: Type): string {
  //add func to env
  if (!env.funcs.has(retType)) {
    env.funcs.set(retType, []);
  }
  var funcList = env.funcs.get(retType);
  return `func_${retType.tag}${funcList.length}`;
}

function genParam(env: Env): Parameter<any> {
  return { name: "", type: { tag: "none" } }; //TODO generate unique parameter name
}

function genFuncDef(
  level: number,
  env: Env,
  className?: string
): Array<string> {
  var funcStrings = [];
  var paramList = [];
  var retType = selectRandomType();
  var funcName = genFuncName(env, retType);
  var funcHeader = "def " + funcName + "(";
  var funcEnv = env.copyEnv();
  var first = true;
  while (true) {
    if (first) {
      first = false;
    } else {
      funcHeader += ", ";
    }
    if (Math.random() > PARAM_CHANCE) {
      break;
    }
    const param = genParam(env);
    paramList.push(param);
    funcHeader += param.name;
  }
  funcHeader += "):";
  funcStrings.push(funcHeader);
  //augment funcEnv with params
  paramList.forEach(function (param) {
    funcEnv.delVar(param.name);
    funcEnv.addVar(param.name, param.type);
  });

  var funcList = env.funcs.get(retType);
  funcList.push({
    name: funcName,
    parameters: paramList,
    ret: retType,
  });

  var body = genBody(level + 1, funcEnv);
  funcStrings = funcStrings.concat(body.program);
  return funcStrings; //TODO
}

function genWhile(level: number): Array<string> {
  return []; //TODO
}

function genIf(level: number, env: Env): Program {
  const currIndent = indent.repeat(level);
  const condition = genExpr({ tag: "bool" }, env);
  const ifStart = currIndent + "if " + condition + ":";
  var stmtList = [ifStart];

  //generate then block
  stmtList = stmtList.concat(genBody(level + 1, env).program); // generate a statement

  //potentially generate elif blocks
  while (true) {
    if (Math.random() > IF_ELIF_CHANCE) {
      //opposite logic since we break
      break; //if we don't want to generate elif
    }
    const elifCondition = genExpr({ tag: "bool" }, env);
    stmtList.push(currIndent + "elif " + elifCondition + " :");
    stmtList = stmtList.concat(genBody(level + 1, env).program); // generate a statement
  }

  //potentially generate else block
  if (Math.random() < IF_ELSE_CHANCE) {
    stmtList.push(currIndent + "else:");
    stmtList = stmtList.concat(genBody(level + 1, env).program); // generate a statement
  }
  return { program: stmtList, stmt: "if" };
}

function genBody(level: number, env: Env): Program {
  var stmtList: Array<string> = [];
  const currIndent = indent.repeat(level);
  var stmt: string;
  while (true) {
    var generated = genStmt(level, env);
    stmtList = stmtList.concat(generated.program); // generate a statement
    stmt = generated.stmt;
    if (Math.random() > BODY_STMT_CHANCE) {
      //opposite logic since
      break; //this tests where to stop
    }
  }

  return { program: stmtList, stmt: stmt };
}

function genDecl(env: Env): Array<string> {
  return [];
}

function genStmt(level: number, env: Env): Program {
  const currIndent = indent.repeat(level);
  const whichStmt: string = selectRandomStmt();
  switch (whichStmt) {
    case "assign":
      const assignType: Type = selectRandomType();
      var name = genId(assignType, env);
      var expr = genExpr(assignType, env);
      return { program: [currIndent + name + " = " + expr], stmt: "assign" };
    // case "return":
    case "expr":
      const exprType: Type = selectRandomType();
      const exprString = currIndent + genExpr(exprType, env);
      return { program: [exprString], stmt: "expr" };
    case "if":
      return genIf(level, env);

    // case "while":

    // case "pass": //this isn't very interesting, do we have to generate pass?

    // case "field-assign":

    default:
      throw new Error(`Unknown stmt in genStmt: ${whichStmt}`);
  }
  return { program: [], stmt: "none" }; //TODO
}

function genExpr(type: Type, env: Env): string {
  const whichExpr: string = selectRandomExpr(type);
  switch (whichExpr) {
    case "literal":
      return genLiteral(type);
    case "id":
      return genId(type, env);
    case "binop":
      var op = selectRandomBinOp(type);
      var leftType: Type;
      var rightType: Type;
      switch (op) {
        case "Plus":
        case "Minus":
        case "Mul":
        case "IDiv":
        case "Mod":
        case "Lte":
        case "Gte":
        case "Lt":
        case "Gt":
          leftType = { tag: "number" };
          rightType = { tag: "number" };
          break;
        case "And":
        case "Or":
          leftType = { tag: "bool" };
          rightType = { tag: "bool" };
          break;
        case "Eq":
        case "Neq":
          leftType = selectRandomType();
          rightType = selectRandomType();
          break;
        case "Is":
          // TODO
          leftType = { tag: "none" };
          rightType = { tag: "none" };
      }
      return (
        genExpr(leftType, env) +
        " " +
        genBinOp(op) +
        " " +
        genExpr(rightType, env)
      );
    case "uniop":
      var op = selectRandomUniOp(type);
      var expr = genExpr(type, env);
      switch (op) {
        case "Neg":
          return `-${expr}`;
        case "Not":
          return `not ${expr}`;
        case "": // if type is not number or bool, just return result of genExpr
          return expr;
        default:
          throw new Error(`Unknown uniop: ${op}`);
      }
    case "call":
    default:
      throw new Error(`Unknown expr in genExpr: ${whichExpr}`);
  }
  return "";
}

function genLiteral(type: Type): string {
  return selectRandomLiteral(type);
}

function genId(type: Type, env: Env): string {
  if (!env.vars.has(type)) {
    env.vars.set(type, []);
  }

  var varList = env.vars.get(type);
  if (varList.length > 0 && Math.random() < 0.5) {
    // use existing variable
    var index = Math.floor(Math.random() * varList.length);
    return varList[index];
  } else {
    // gen new variable
    var idName: string;
    if (type.tag == "class") {
      idName = `${type.name}${varList.length}`;
    } else {
      idName = `${type.tag}${varList.length}`;
    }
    varList.push(idName);
    return idName;
  }
}

function genBinOp(op: string): string {
  switch (op) {
    case "Plus":
      return "+";
    case "Minus":
      return "-";
    case "Mul":
      return "*";
    case "IDiv":
      return "//";
    case "Mod":
      return "%";
    case "Eq":
      return "==";
    case "Neq":
      return "!=";
    case "Lte":
      return "<=";
    case "Gte":
      return ">=";
    case "Lt":
      return "<";
    case "Gt":
      return ">";
    case "Is":
      return "is";
    case "And":
      return "and";
    case "Or":
      return "or";
    default:
      throw new Error(`Unknown binop: ${op}`);
  }
}

export function genProgram(): string {
  initDefaultProbs();
  var env = new Env();
  const level = 0;
  var program: Program;
  //generate something

  const body = genBody(0, env);
  program.program = program.program.concat(body.program);

  //do this after genBody since we need to know about all the functions/variables
  program.program = genDecls(env).concat(program.program);

  program.stmt = body.stmt;
  if (program.stmt === "expr") {
    program.program[program.program.length - 1] =
      "print(" + program.program[program.program.length - 1] + ")";
  }
  return program.program.join("\n");
}
