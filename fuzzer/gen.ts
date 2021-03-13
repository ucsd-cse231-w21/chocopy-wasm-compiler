import { Type } from "../ast";

import {
  INDENT,
  INNER_CLASS_LEVEL,
  Parameter,
  FunDef,
  ClassDef,
  Program,
  ProbPair,
} from "./structs";

import {
  BODY_STMT_CHANCE,
  IF_ELIF_CHANCE,
  IF_ELSE_CHANCE,
  PARAM_CHANCE,
  CLASS_FIELD_CHANCE,
  CLASS_METHOD_CHANCE,
  INIT_TYPE_PROBS,
  INIT_CORRECT_PROBS,
  INIT_STMT_PROBS,
  INIT_EXPR_PROBS,
  INIT_NUMBER_LITERAL_PROBS,
  INIT_BOOL_LITERAL_PROBS,
  INIT_NUMBER_BINOP_PROBS,
  INIT_BOOL_BINOP_PROBS,
  INIT_NEW_PROBS,
  INIT_NEW_CLASS_PROBS,
  selectFromProbTable,
} from "./probs";

import {
  convertStrToType,
  convertTypeToStr,
  convertStrToPythonType,
  convertTypeToPythonType,
  cleanProgram,
} from "./util";

var StmtProbs: Array<ProbPair>;
var ExprProbs: Array<ProbPair>;
var numberLiteralProbs: Array<ProbPair>;
var boolLiteralProbs: Array<ProbPair>;
var numberBinopProbs: Array<ProbPair>;
var boolBinopProbs: Array<ProbPair>;
var TypeProbs: Array<ProbPair>;
var newProbs: Array<ProbPair>;
var newClassProbs: Array<ProbPair>;
var CorrectProbs: Array<ProbPair>; // probability of generating something correct

/** Initialize Probability Tables */
function initDefaultProbs() {
  StmtProbs = [...INIT_STMT_PROBS];
  ExprProbs = [...INIT_EXPR_PROBS];
  numberLiteralProbs = [...INIT_NUMBER_LITERAL_PROBS];
  boolLiteralProbs = [...INIT_BOOL_LITERAL_PROBS];
  TypeProbs = [...INIT_TYPE_PROBS];
  numberBinopProbs = [...INIT_NUMBER_BINOP_PROBS];
  boolBinopProbs = [...INIT_BOOL_BINOP_PROBS];
  newProbs = [...INIT_NEW_PROBS];
  newClassProbs = [...INIT_NEW_CLASS_PROBS];
  CorrectProbs = [...INIT_CORRECT_PROBS];
}
/* initDefaultProbs */

class Env {
  vars: Map<string, Array<string>>;
  funcs: Map<string, Array<FunDef>>;
  classes: Map<string, ClassDef>;

  constructor() {
    this.vars = new Map();
    this.funcs = new Map();
    this.classes = new Map();
  }

  /**
   * Add Var to Env
   * @param name variable name
   * @param type variable type
   */
  addVar(name: string, type: Type) {
    var typeString = convertTypeToStr(type);
    if (!this.vars.has(typeString)) {
      this.vars.set(typeString, []);
    }
    this.vars.get(typeString).push(name);
  }
  /* addVar */

  /**
   * Delete Var from Env
   * @param varName variable name
   */
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
  /* delVar */

  /**
   * Get Array of variables with specific type
   * @param type variable type
   * @return Array of variable names (strings)
   */
  getVars(type: Type): Array<string> {
    var typeString: string = convertTypeToStr(type);
    return this.vars.get(typeString);
  }
  /* getVars */

  /**
   * Add function definition to Env
   * @param func function definition struct
   */
  addFunc(func: FunDef) {
    var typeString: string = convertTypeToStr(func.ret);
    if (!this.funcs.has(typeString)) {
      this.funcs.set(typeString, []);
    }
    this.funcs.get(typeString).push(func);
  }
  /* addFunc */

  /**
   * Select random function with specific return type
   * @param type return type of function
   * @return FunDef of selected function
   */
  selectRandomFunc(type: Type): FunDef {
    var typeString = convertTypeToStr(type);
    if (!this.funcs.has(typeString) || this.funcs.get(typeString).length == 0) {
      return undefined; //sentinel value for no possible fundef
    }
    const tyFuncs = this.funcs.get(typeString);
    if (tyFuncs.length == 0) {
      throw new Error("Attempting to select random function from list of size 0"); //should never get here
    }
    return tyFuncs[Math.floor(Math.random() * tyFuncs.length)];
  }
  /* selectRandomFunc */

  /**
   * Add class definition to Env
   * @param class class definition struct
   */
  addClass(cls: ClassDef) {
    this.classes.set(cls.name, cls);
  }
  /* addClass */

  /**
   * Get class definition from class name
   * @param className name of class
   * @return class definition
   */
  getClass(className: string): ClassDef {
    if (!this.classes.has(className)) return undefined;
    return this.classes.get(className);
  }
  /* getClass */

  /**
   * Get all class names
   * @return Array of class names (string)
   */
  getClassNames(): Array<string> {
    return Array.from(this.classes.keys());
  }
  /* getClassnames */

  /**
   * Create a new copy of Env
   * @return new copy of Env
   */
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
  /* copyEnv */
}

/**
 * Select random type
 * @param env current Env
 * @param level current Level
 * @return random selected type
 */
function selectRandomType(env: Env, level: number): Type {
  var typeStr = selectFromProbTable(TypeProbs);
  if (typeStr == "class") {
    if (level != undefined && level > 0 && env.getClassNames().length === 0) {
      return selectRandomType(env, level);
    }
    var className = selectRandomClassName(env, level);
    if (className == undefined) return selectRandomType(env, level);
    return convertStrToType(typeStr, className);
  }
  return convertStrToType(typeStr);
}
/* selectRandomType */

/**
 * Select random stmt tag from stmt probability table
 * @return stmt tag (string)
 */
function selectRandomStmt(): string {
  return selectFromProbTable(StmtProbs);
}
/* selectRandomStmt */

/**
 * Select random literal tag for specific type
 * @param type type of literal
 * @return literal tag (string)
 */
function selectRandomLiteral(type: Type): string {
  switch (type.tag) {
    case "number":
      return selectFromProbTable(numberLiteralProbs);
    case "bool":
      return selectFromProbTable(boolLiteralProbs);
    case "none":
      return "None";
    case "class":
      return "None";
  }
}
/* selectRandomLiteral */

/**
 * Select random expr tag
 * @return expr tag (string)
 */
function selectRandomExpr(): string {
  return selectFromProbTable(ExprProbs);
}
/* selectRandomExpr */

/**
 * Select random binop tag for specific type
 * @param type return type of bin op
 * @return binop tag (string)
 */
function selectRandomBinOp(type: Type): string {
  switch (type.tag) {
    case "number":
      return selectFromProbTable(numberBinopProbs);
    case "bool":
      return selectFromProbTable(boolBinopProbs);
    case "none":
      return "Is";
    case "class":
      return "Is";
    default:
      throw new Error(`Unknown type from selectRandomBinOp: ${type.tag}`);
  }
}
/* selectRandomBinOp */

/**
 * Select random uniop tag for specific type
 * @param type return type of uniop
 * @return uniop tag (string)
 */
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
/* selectRandomUniOp */

/**
 * Generate new function signature or select an existing one
 * @param retType return type of function
 * @param env current Env
 * @param level current Level
 * @return function definition
 */
function selectFuncSig(retType: Type, env: Env, level: number): FunDef {
  var toGen = selectFromProbTable(newProbs);
  switch (toGen) {
    case "new":
      const newSig = genFuncSig(retType, env, level);
      env.addFunc(newSig);
      return newSig;
    case "existing":
      return env.selectRandomFunc(retType);
    default:
      throw new Error(`Selected unknown action in selectFuncSig: ${toGen}`);
  }
}
/* selectFuncSig */

/**
 * Generate new class or select an existing one
 * @param env current Env
 * @param level current Level
 * @return Class name (string)
 */
function selectRandomClassName(env: Env, level: number): string {
  var toGen = selectFromProbTable(newClassProbs);
  var classList = env.getClassNames();
  if (classList.length === 0) {
    toGen = "new";
  } else if (level > 0) {
    toGen = "existing";
  }

  switch (toGen) {
    case "new":
      var className = "class_" + classList.length;
      genClassSig(env, className);
      return className;
    case "existing":
      if (classList.length === 0) return undefined;
      var index = Math.floor(Math.random() * (classList.length - 1));
      return classList[index];
    default:
      throw new Error(`Selected unknown action in selectRandomClassName: ${toGen}`);
  }
}
/* selectRandomClassName */

/**
 * Generate stmt block
 * @param env current Env
 * @param level current Level
 * @return Program
 */
function genStmt(env: Env, level: number): Program {
  const currIndent = INDENT.repeat(level);
  const whichStmt: string = selectRandomStmt();
  switch (whichStmt) {
    case "assignment":
      var assignType: Type = selectRandomType(env, level);
      while (assignType.tag == "none") assignType = selectRandomType(env, level);

      var name = genId(assignType, env);
      var expr = genExpr(assignType, env, level);
      return { program: [currIndent + name + " = " + expr], lastStmt: "assignment" };
    case "expr":
      const exprType: Type = selectRandomType(env, level);
      const exprString = currIndent + genExpr(exprType, env, level);
      return { program: [exprString], lastStmt: "expr" };
    case "if":
      return genIf(env, level);

    default:
      throw new Error(`Unknown stmt in genStmt: ${whichStmt}`);
  }
}
/* genStmt */

/**
 * Generate expr line
 * @param type return type of expr
 * @param env current Env
 * @param level current Level
 * @return string
 */
function genExpr(type: Type, env: Env, level: number): string {
  const whichExpr: string = selectRandomExpr();

  switch (whichExpr) {
    case "literal":
      if (type.tag == "class") {
        return genExpr(type, env, level); //reroll the expr
      }
      return genLiteral(type);
    case "id":
      if (type.tag == "none") return genExpr(type, env, level); // hacky
      return genId(type, env);
    case "binop":
      if (!["number", "bool"].includes(type.tag)) return genExpr(type, env, level); //reroll the expr
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
          leftType = selectRandomType(env, level);
          rightType = selectRandomType(env, level);
          break;
        case "Is":
          // TODO class or none
          leftType = { tag: "none" };
          rightType = { tag: "none" };
      }
      return (
        genExpr(leftType, env, level) + " " + genBinOp(op) + " " + genExpr(rightType, env, level)
      );
    case "uniop":
      if (type.tag == "class") return genExpr(type, env, level);

      var op = selectRandomUniOp(type);
      var expr = genExpr(type, env, level);
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
    case "call":
      //roll for existing or new function
      const funcSig = selectFuncSig(type, env, level);
      if (funcSig === undefined) {
        //something went wrong, reroll the entire expr
        return genExpr(type, env, level);
      }
      var callString = funcSig.name + "(";
      var comma = 0;
      for (var i = 0; i < funcSig.parameters.length; i++) {
        if (i > comma) {
          callString += ", ";
        }
        if (funcSig.parameters[i].name == "self") {
          comma++;
          continue;
        }
        callString += genExpr(funcSig.parameters[i].type, env, level);
      }
      callString += ")";
      return callString;
    case "construct":
      if (type.tag != "class") {
        return genExpr(type, env, level); //reroll non-class types
      }
      return genConstruct(type);
    default:
      throw new Error(`Unknown expr in genExpr: ${whichExpr}`);
  }
  return "";
}
/* genExpr */

/**
 * Generate literal string
 * @param type return type of literal
 * @return string
 */
function genLiteral(type: Type): string {
  return selectRandomLiteral(type);
}
/* genLiteral */

/**
 * Generate variable name
 * @param type type of variable
 * @param env current Env
 * @return string
 */
function genId(type: Type, env: Env): string {
  var typeStr = convertTypeToStr(type);

  var vars = env.vars;

  if (!vars.has(typeStr)) {
    vars.set(typeStr, []);
  }

  var varList = env.getVars(type);
  var varName: string;
  if (varList.length > 0 && Math.random() < 0.5) {
    // use existing variable
    var index = Math.floor(Math.random() * varList.length);
    varName = varList[index];
  } else {
    // gen new variable
    varName = `${typeStr}_${varList.length}`;
    varList.push(varName);
  }

  if (type.tag == "class") {
    genClassSig(env, type.name, varName);
  }
  return varName;
}
/* genId */

/**
 * Generate variable declaration
 * @param name of variable
 * @param type of variable
 * @return string
 */
function genIdDecl(name: string, type: Type): string {
  if (name.includes(".") || name.includes("param") || name == "self") return "";

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
/* genIdDecl */

/**
 * Generate binary op
 * @param op binop tag
 * @return string
 */
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
/* genBinOp */

/**
 * Generate if stmt
 * @param env current Env
 * @param level current Level
 * @return Program
 */
function genIf(env: Env, level: number): Program {
  const currIndent = INDENT.repeat(level);
  const condition = genExpr({ tag: "bool" }, env, level);
  const ifStart = currIndent + "if " + condition + ":";
  var stmtList = [ifStart];

  //generate then block
  stmtList = stmtList.concat(genBody(env, level + 1).program); // generate a statement

  //potentially generate elif blocks
  while (true) {
    if (Math.random() > IF_ELIF_CHANCE) {
      //opposite logic since we break
      break; //if we don't want to generate elif
    }
    const elifCondition = genExpr({ tag: "bool" }, env, level);
    stmtList.push(currIndent + "elif " + elifCondition + " :");
    stmtList = stmtList.concat(genBody(env, level + 1).program); // generate a statement
  }

  //potentially generate else block
  if (Math.random() < IF_ELSE_CHANCE) {
    stmtList.push(currIndent + "else:");
    stmtList = stmtList.concat(genBody(env, level + 1).program); // generate a statement
  }
  return { program: stmtList, lastStmt: "if" };
}
/* genIf */

/**
 * Generate while stmt
 * @param env current Env
 * @param level current Level
 * @return Program
 */
function genWhile(env: Env, level: number): Array<string> {
  return []; //TODO
}
/* genWhile */

/**
 * Generate body of function
 * @param env current Env
 * @param level current Level
 * @param retType return type of body
 * @return Program
 */
function genBody(env: Env, level: number, retType?: Type): Program {
  var stmtList: Array<string> = [];
  const currIndent = INDENT.repeat(level);
  var lastStmt: string;
  while (true) {
    var generated = genStmt(env, level);
    stmtList = stmtList.concat(generated.program); // generate a statement
    lastStmt = generated.lastStmt;
    if (Math.random() > BODY_STMT_CHANCE) {
      //opposite logic since
      break; //this tests where to stop
    }
  }

  if (retType !== undefined) {
    //generate return stmt
    stmtList.push(currIndent + "return " + genExpr(retType, env, level));
    // TODO this does not account for returns in if stmts
    lastStmt = "expr";
  }

  return {
    program: stmtList.filter((block) => {
      return block !== "";
    }),
    lastStmt: lastStmt,
  };
}
/* genBody */

/**
 * Generate function name
 * @param env current Env
 * @param retType return type of function
 * @return Program
 */
function genFuncName(env: Env, retType: Type): string {
  var retTypeString = convertTypeToStr(retType);
  if (!env.funcs.has(retTypeString)) {
    env.funcs.set(retTypeString, []);
  }
  var funcList = env.funcs.get(retTypeString);
  return `func_${retType.tag}_${funcList.length}`;
}
/* genFuncName */

/**
 * Generate parameters for functions
 * @param paramName name of parameter
 * @param env current Env
 * @param level current Level
 * @return Program
 */
function genParam(paramName: string, env: Env, level: number): Parameter {
  var paramType = selectRandomType(env, level);
  while (paramType.tag === "none") paramType = selectRandomType(env, level);
  return { name: paramName, type: paramType }; //TODO generate unique parameter name
}
/* genParam */

/**
 * Generate function signature
 * @param retType return type of function
 * @param env current Env
 * @param level current Level
 * @param className [className] name of class
 * @return FunDef
 */
function genFuncSig(retType: Type, env: Env, level: number, className?: string): FunDef {
  var paramList = [];
  var funcName = genFuncName(env, retType);
  var paramIndex = 0;

  if (className !== undefined) {
    var classType: Type = { tag: "class", name: className };
    paramList.push({ name: "self", type: classType });
  }

  while (true) {
    if (Math.random() > PARAM_CHANCE) {
      break;
    }
    const param = genParam(`${funcName}_param_${paramIndex}`, env, level + 1);
    paramList.push(param);
    paramIndex++;
  }

  return {
    name: funcName,
    parameters: paramList,
    ret: retType,
  };
}
/* genFuncSig */

/**
 * Generate function declaration
 * @param env current Env
 * @param level current Level
 * @param sig function signature
 * @param className name of class
 * @return code block for function definition
 */
function genFuncDecl(env: Env, level: number, sig: FunDef): Array<string> {
  if (sig.name.includes(".")) return [];

  var currIndent = INDENT.repeat(level);
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
  var retTypeStr = convertTypeToStr(retType);
  if (retType) {
    retTypeStr = retTypeStr == "none" ? "" : " -> " + convertStrToPythonType(retTypeStr);
  }
  funcHeader += `)${retTypeStr}:`;

  funcStrings.push(funcHeader);

  //augment funcEnv with params
  paramList.forEach(function (param) {
    funcEnv.delVar(param.name);
    funcEnv.addVar(param.name, param.type);
  });

  var body = genBody(funcEnv, level + 1, retType);
  var decls = genDecl(funcEnv, env, level + 1);
  funcStrings = funcStrings.concat(decls);
  funcStrings = funcStrings.concat(body.program);
  return funcStrings; //TODO
}
/* genFuncDecl */

/**
 * Generate class signature and populate all lookup calls into env variables and functions
 * @param env current Env
 * @param className name of class
 * @param varName name of variable of declared class
 */
function genClassSig(env: Env, className: string, varName?: string) {
  if (env.classes.has(className)) {
    var fields = env.classes.get(className).fields;
    var methods = env.classes.get(className).methods;

    fields.forEach((fieldName) => {
      if (varName) {
        env.addVar(varName + "." + fieldName, varType);
      }
    });

    methods.forEach((funcDef) => {
      if (varName) {
        var newFuncDef: FunDef = {
          name: varName + "." + funcDef.name,
          parameters: funcDef.parameters,
          ret: funcDef.ret,
        };
        env.addFunc(newFuncDef);
      }
    });
    return;
  }

  var fields: Map<string, Array<string>> = new Map();
  while (Math.random() < CLASS_FIELD_CHANCE || Array.from(fields.keys()).length == 0) {
    var varType = selectRandomType(env, 1);
    while (varType.tag == "none") varType = selectRandomType(env, 1);
    var varTypeStr = convertTypeToStr(varType);

    if (!fields.has(varTypeStr)) {
      fields.set(varTypeStr, []);
    }

    var fieldsList = fields.get(varTypeStr);
    var fieldName = varTypeStr + "_" + fieldsList.length;

    fieldsList.push(fieldName);
    if (varName) {
      env.addVar(varName + "." + fieldName, varType);
    }
  }

  var methods: Array<FunDef> = [];
  while (Math.random() < CLASS_METHOD_CHANCE || methods.length == 0) {
    var retType = selectRandomType(env, INNER_CLASS_LEVEL);
    var funcDef = genFuncSig(retType, env, INNER_CLASS_LEVEL, className);

    methods.push(funcDef);

    if (varName) {
      var newFuncDef: FunDef = {
        name: varName + "." + funcDef.name,
        parameters: funcDef.parameters,
        ret: funcDef.ret,
      };
      env.addFunc(newFuncDef);
    }
  }

  var classDef: ClassDef = {
    name: className,
    fields: fields,
    methods: methods,
  };
  env.addClass(classDef);
}
/* genClassSig */

/**
 * Generate class declaration
 * @param env current Env
 * @param level current Level
 * @param className name of class
 * @return code block for class definition
 */
function genClassDecl(env: Env, level: number, className: string): Array<string> {
  if (level > 0) return [];
  var currIndent = INDENT.repeat(level);
  var classStrings = [];
  var classHeader = currIndent + "class " + className + "(object):";

  classStrings.push(classHeader);

  var classEnv = env.copyEnv();

  var decls: Array<string> = [];
  var classDef: ClassDef = env.getClass(className);
  if (classDef === undefined) {
    throw new Error(`Class ${className} not found in the environment`);
  }

  classDef.fields.forEach((varNames: Array<string>, varType: string) => {
    varNames.forEach((varName: string) => {
      decls.push(currIndent + INDENT + genIdDecl(varName, convertStrToType(varType)));
      classEnv.addVar("self." + varName, convertStrToType(varType));
    });
  });

  classDef.methods.forEach((fun_def: FunDef) => {
    decls = decls.concat(genFuncDecl(classEnv, level + 1, fun_def));
  });

  classStrings = classStrings.concat(decls);

  return classStrings;
}
/* genClassDecl */

/**
 * Generate construct
 * @param type class type
 * @return string
 */
function genConstruct(type: Type): string {
  if (type.tag != "class") {
    throw new Error("Generating construct on non-class type");
  }
  return `${type.name}()`; //constructors always have no parameters
}
/* genConstruct */

/**
 * Generate decls from environment
 * @param env env at current level
 * @param upperEnv env at 1 level up
 * @param level current level
 * @className optional classname
 * @return code blocks for all class, variable, and function declarations
 */
function genDecl(env: Env, upperEnv: Env, level: number, className?: string): Array<string> {
  var currIndent = INDENT.repeat(level);

  var varDecls: Array<string> = [];
  var classConstructs: Array<string> = [];
  env.vars.forEach((names: Array<string>, type: string) => {
    names.forEach((name: string) => {
      if (!upperEnv.vars.has(type) || !upperEnv.vars.get(type).includes(name)) {
        varDecls.push(currIndent + genIdDecl(name, convertStrToType(type)));
        if (name != "self" && !name.includes(".") && type.includes("class")) {
          classConstructs.push(currIndent + name + " = " + type + "()");
        }
      }
    });
  });

  var classDecls: Array<string> = [];
  env.classes.forEach((_: ClassDef, className: string) => {
    if (!upperEnv.getClass(className)) {
      classDecls = classDecls.concat(genClassDecl(env, level, className));
    }
  });

  var funcDecls: Array<string> = [];
  env.funcs.forEach((funcDefs: Array<FunDef>, type: string) => {
    funcDefs.forEach((funcDef: FunDef) => {
      if (!upperEnv.funcs.has(type) || !upperEnv.funcs.get(type).includes(funcDef)) {
        funcDecls = funcDecls.concat(genFuncDecl(env, level, funcDef));
      }
    });
  });

  return classDecls.concat(varDecls).concat(funcDecls).concat(classConstructs);
}
/* genDecl */

/**
 * Generate 2 program strings to fuzz
 * @return to_python, python shell program string
 * @return to_repl, repl program string
 */
export function genProgram(): { to_python: string; to_repl: string } {
  initDefaultProbs();
  var env = new Env();
  const level = 0;
  var program: Program = {
    program: [],
    lastStmt: "",
  };

  const body = genBody(env, 0);
  program.program = body.program;

  //do this after genBody since we need to know about all the functions/variables

  program.program = genDecl(env, new Env(), level).concat(program.program);

  var toReturn = {
    to_repl: cleanProgram(program.program),
    to_python: "",
  };
  program.lastStmt = body.lastStmt;
  if (program.lastStmt === "expr") {
    program.program[program.program.length - 1] =
      "print(" + program.program[program.program.length - 1] + ")";
  }

  var emptyClassDecl: Array<string> = [];
  // gen empty class decl
  env.classes.forEach((_: ClassDef, className: string) => {
    emptyClassDecl.push("class " + className + "(object):");
    emptyClassDecl.push(INDENT + "pass");
  });

  toReturn.to_python = cleanProgram(emptyClassDecl.concat(program.program));
  return toReturn;
}
/* genProgram */
