import { Type } from "../ast";

const indent = "  ";

type Parameter = { name: string; type: Type };

type FunDef = {
  name: string;
  parameters: Array<Parameter>;
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
  vars: Map<string, Array<string>>;
  funcs: Map<string, Array<FunDef>>;

  constructor() {
    this.vars = new Map();
    this.funcs = new Map();
  }

  addVar(name: string, type: Type) {
    var typeString = typeToTypeString(type);
    if (!this.vars.has(typeString)) {
      this.vars.set(typeString, []);
    }
    this.vars.get(typeString).push(name);
  }

  delVar(varName: string) {
    this.vars.forEach((names: Array<string>, type: string) => {
      this.vars.set(
        type,
        names.filter(function (name) {
          return name !== varName;
        })
      );
    });
  }

  getVars(type: Type) {
    var typeString: string = typeToTypeString(type);
    return this.vars.get(typeString);
  }

  addFunc(func: FunDef) {
    var typeString: string = typeToTypeString(func.ret);
    if (!this.funcs.has(typeString)) {
      this.funcs.set(typeString, []);
    }
    this.funcs.get(typeString).push(func);
  }

  copyEnv(): Env {
    var newEnv = new Env();

    var newVars = new Map();
    this.vars.forEach((value: Array<string>, key: string) => {
      newVars.set(key, [...value]);
    });

    var newFuncs = new Map();
    this.funcs.forEach((value: Array<FunDef>, key: string) => {
      newFuncs.set(key, [...value]);
    });

    newEnv.vars = newVars;
    newEnv.funcs = newFuncs;
    return newEnv;
  }

  selectRandomFunc(type: Type): FunDef {
    var typeString = typeToTypeString(type);
    if (!this.funcs.has(typeString)) {
      return undefined; //sentinel value for no possible fundef
    }
    const tyFuncs = this.funcs.get(typeString);
    if (tyFuncs.length == 0) {
      throw new Error("Attempting to select random function from list of size 0"); //should never get here
    }
    return tyFuncs[Math.floor(Math.random() * tyFuncs.length)];
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
var newProbs: Array<ProbPair>;

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
  { key: "literal", prob: 0.3 },
  { key: "id", prob: 0.5 },
  { key: "binop", prob: 0.7 },
  { key: "uniop", prob: 0.8 },
  { key: "call", prob: 1 },
  { key: "builtin1", prob: 1 },
  { key: "builtin2", prob: 1 },
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

const initNewProbs = [
  { key: "new", prob: 0.1 },
  { key: "existing", prob: 1 },
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
  newProbs = [...initNewProbs];
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
      //TODO add class
      throw new Error(`Unknown type from key: ${key}`);
  }
}

function convertTypeToPythonType(type: Type): string {
  switch (type.tag) {
    case "number":
      return "int";
    case "bool":
      return "bool";
    case "none":
      throw new Error(`Unknown type from key: ${type.tag}`);
    case "class":
      return type.name;
  }
}

function typeToTypeString(type: Type): string {
  var typeString: string = type.tag;
  if (type.tag == "class") {
    typeString = type.name;
  }
  return typeString;
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

function selectFuncSig(ty: Type, env: Env): FunDef {
  var toGen = selectKey(newProbs);
  switch (toGen) {
    case "new":
      const newSig = genFuncSig(ty, env);
      env.addFunc(newSig);
      return newSig;
    case "existing":
      return env.selectRandomFunc(ty);
    default:
      throw new Error(`Selected unknown action in selectFuncSig: ${toGen}`);
  }
}

function selectRandomStmt(): string {
  return selectKey(StmtProbs);
}

function genClassDef(level: number, env: Env): Array<string> {
  return []; //TODO
}

function genFuncName(env: Env, retType: Type): string {
  //add func to env
  var retTypeString = typeToTypeString(retType);
  if (!env.funcs.has(retTypeString)) {
    env.funcs.set(retTypeString, []);
  }
  var funcList = env.funcs.get(retTypeString);
  return `func_${retType.tag}_${funcList.length}`;
}

function genParam(paramName: string): Parameter {
  var paramType = selectRandomType();
  while (paramType.tag === "none") paramType = selectRandomType();
  return { name: paramName, type: paramType }; //TODO generate unique parameter name
}

function genFuncSig(ty: Type, env: Env): FunDef {
  var paramList = [];
  var retType = ty; //fixed function return type
  var funcName = genFuncName(env, retType);
  var first = true;
  var paramIndex = 0;
  while (true) {
    if (first) {
      first = false;
    }
    if (Math.random() > PARAM_CHANCE) {
      break;
    }
    const param = genParam(`${funcName}_param_${paramIndex}`);
    paramList.push(param);
    paramIndex++;
  }

  return {
    name: funcName,
    parameters: paramList,
    ret: retType,
  };
}

function genVarDef(name: string, type: Type): string {
  switch (type.tag) {
    case "number":
      return `${name}:int = 1`;
    case "bool":
      return `${name}:bool = False`;
    case "none":
      throw new Error(`Variable cannot be decl as none type`);
    case "class":
      return `${name}:${type.name} = None`;
  }
}

function genFuncDef(level: number, env: Env, sig: FunDef, className?: string): Array<string> {
  var currIndent = indent.repeat(level);
  var funcStrings = [];
  var paramList = sig.parameters;
  var retType = sig.ret;
  var funcName = sig.name;
  var funcHeader = currIndent + "def " + funcName + "(";
  var funcEnv = env.copyEnv();
  var first = true;

  for (var i = 0; i < paramList.length; i++) {
    if (first) {
      first = false;
    } else {
      funcHeader += ", ";
    }
    funcHeader += paramList[i].name + ": " + convertTypeToPythonType(paramList[i].type);
  }
  funcHeader += "):";
  funcStrings.push(funcHeader);

  //augment funcEnv with params
  paramList.forEach(function (param) {
    funcEnv.delVar(param.name);
    funcEnv.addVar(param.name, param.type);
  });

  var body = genBody(level + 1, funcEnv);
  var decls = genDecl(funcEnv, env, level + 1);
  funcStrings = funcStrings.concat(decls);
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

function genDecl(env: Env, upperEnv: Env, level: number): Array<string> {
  var varDecls: Array<string> = [];
  var currIndent = indent.repeat(level);
  env.vars.forEach((names: Array<string>, type: string) => {
    names.forEach((name: string) => {
      if (!upperEnv.vars.has(type) || !upperEnv.vars.get(type).includes(name)) {
        varDecls.push(currIndent + genVarDef(name, convertTypeFromKey(type)));
      }
    });
  });

  var funcDecls: Array<string> = [];
  env.funcs.forEach((funcDefs: Array<FunDef>, type: string) => {
    funcDefs.forEach((funcDef: FunDef) => {
      if (!upperEnv.funcs.has(type) || !upperEnv.funcs.get(type).includes(funcDef)) {
        funcDecls = funcDecls.concat(genFuncDef(level, env, funcDef));
      }
    });
  });

  return varDecls.concat(funcDecls);
}

function genStmt(level: number, env: Env): Program {
  const currIndent = indent.repeat(level);
  const whichStmt: string = selectRandomStmt();
  switch (whichStmt) {
    case "assign":
      var assignType: Type = selectRandomType();
      while (assignType.tag == "none") assignType = selectRandomType();
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
      if (type.tag == "none") return genExpr(type, env); // hacky
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
      return genExpr(leftType, env) + " " + genBinOp(op) + " " + genExpr(rightType, env);
    case "uniop":
      var op = selectRandomUniOp(type);
      var expr = genExpr(type, env);
      switch (op) {
        case "Neg":
          return `(-${expr})`;
        case "Not":
          return `(not ${expr})`;
        case "": // if type is not number or bool, just return result of genExpr
          return expr;
        default:
          throw new Error(`Unknown uniop: ${op}`);
      }
    case "call": //TODO: sometimes incorrect return types make it into the environment
      //roll for existing or new function
      const funcSig = selectFuncSig(type, env);
      if (funcSig === undefined) {
        //something went wrong, reroll the entire expr
        return genExpr(type, env);
      }
      var callString = funcSig.name + "(";
      for (var i = 0; i < funcSig.parameters.length; i++) {
        if (i > 0) {
          callString += ", ";
        }
        callString += genExpr(funcSig.parameters[i].type, env);
      }
      callString += ")";
      return callString;

    default:
      throw new Error(`Unknown expr in genExpr: ${whichExpr}`);
  }
  return "";
}

function genLiteral(type: Type): string {
  return selectRandomLiteral(type);
}

function genId(type: Type, env: Env): string {
  var typeString = typeToTypeString(type);
  if (!env.vars.has(typeString)) {
    env.vars.set(typeString, []);
  }

  var varList = env.vars.get(typeString);
  if (varList.length > 0 && Math.random() < 0.5) {
    // use existing variable
    var index = Math.floor(Math.random() * varList.length);
    return varList[index];
  } else {
    // gen new variable
    var idName: string;
    if (type.tag == "class") {
      idName = `${type.name}_${varList.length}`;
    } else {
      idName = `${type.tag}_${varList.length}`;
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

export function genProgram(): { to_python: string; to_repl: string } {
  initDefaultProbs();
  var env = new Env();
  const level = 0;
  var program: Program = {
    program: [],
    stmt: "",
  };
  //generate something

  const body = genBody(0, env);
  program.program = body.program;

  //do this after genBody since we need to know about all the functions/variables
  program.program = genDecl(env, new Env(), level).concat(program.program);

  var toReturn = {
    to_repl: program.program.join("\n"),
    to_python: "",
  };
  program.stmt = body.stmt;
  if (program.stmt === "expr") {
    program.program[program.program.length - 1] =
      "print(" + program.program[program.program.length - 1] + ")";
  }
  toReturn.to_python = program.program.join("\n");
  return toReturn;
}
