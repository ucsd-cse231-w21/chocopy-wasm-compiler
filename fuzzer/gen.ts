import { Type } from "../ast";

const indent: string = "    ";
const rangeMax: number = 1;

type ProbPair = {
  prob: number;
  key: string;
};

var StmtProbs: Array<ProbPair>;
var ExprProbs: Array<ProbPair>;
var numberLiteralProbs: Array<ProbPair>;
var boolLiteralProbs: Array<ProbPair>;
var classLiteralProbs: Array<ProbPair>;
var numberBinopProbs: Array<ProbPair>;
var boolBinopProbs: Array<ProbPair>;
var TypeProbs: Array<ProbPair>;

var CorrectProbs: Array<ProbPair>; // probability of generating something correct

var VariableMap: Map<Type, Array<string>>;

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
  { key: "expr", prob: 1 },
  { key: "assign", prob: 1 },
  { key: "return", prob: 1 },
  { key: "if", prob: 1 },
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

function genClassDef(level: number): Array<string> {
  return []; //TODO
}

function genFuncDef(level: number, className?: string): Array<string> {
  return []; //TODO
}

function genWhile(level: number): Array<string> {
  return []; //TODO
}

function genIf(level: number): Array<string> {
  return []; //TODO
}

function genStmt(level: number): Array<string> {
  const currIndent = indent.repeat(level);
  const whichStmt: string = selectRandomStmt();
  switch (whichStmt) {
    // case "assign":
    //   return {
    //     tag: "assign",
    //     name: "",
    //     value: selectRandomExpr(),
    //   };
    // case "return":
    case "expr":
      const exprType: Type = selectRandomType();
      const exprString = currIndent + genExpr(exprType);
      return [exprString];

    // case "if":

    // case "while":

    // case "pass":

    // case "field-assign":

    default:
      throw new Error(`Unknown stmt in genStmt: ${whichStmt}`);
  }
  return []; //TODO
}

function genExpr(type: Type): string {
  const whichExpr: string = selectRandomExpr(type);
  switch (whichExpr) {
    case "literal":
      return genLiteral(type);
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
      return genExpr(leftType) + " " + genBinOp(op) + " " + genExpr(rightType);
    case "uniop":
      var op = selectRandomUniOp(type);
      var expr = genExpr(type);
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
    default:
      throw new Error(`Unknown expr in genExpr: ${whichExpr}`);
  }
  return "";
}

function genLiteral(type: Type): string {
  return selectRandomLiteral(type);
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

export function genProgram(): Array<string> {
  initDefaultProbs();
  const level = 0;
  var program: Array<string> = [];
  while (true) {
    //generate something
    if (Math.random() > 0.9) {
      break;
    }
    program = program.concat(genStmt(0));
  }
  return program;
}
