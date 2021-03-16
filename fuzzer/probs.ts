import { ProbPair } from "./structs";

export const BODY_STMT_CHANCE = 0.5;
export const IF_ELIF_CHANCE = 0.2;
export const IF_ELSE_CHANCE = 0.5;
export const PARAM_CHANCE = 0.5;
export const CLASS_FIELD_CHANCE = 0.25;
export const CLASS_METHOD_CHANCE = 0.05;

export const INIT_TYPE_PROBS = [
  { key: "number", prob: 0.4 },
  { key: "bool", prob: 0.5 },
  { key: "class", prob: 0.95 },
  { key: "none", prob: 1 },
];

export const INIT_STMT_PROBS = [
  { key: "expr", prob: 0.7 },
  { key: "if", prob: 0.9 },
  { key: "assignment", prob: 1 },
  { key: "return", prob: 1 },
  { key: "while", prob: 1 },
  { key: "pass", prob: 1 },
  { key: "field-assign", prob: 1 },
];

export const INIT_EXPR_PROBS = [
  { key: "literal", prob: 0.3 },
  { key: "id", prob: 0.5 },
  { key: "binop", prob: 0.85 },
  { key: "uniop", prob: 0.95 },
  { key: "call", prob: 1 },
  { key: "builtin1", prob: 1 },
  { key: "builtin2", prob: 1 },
  { key: "lookup", prob: 1 },
  { key: "method-call", prob: 1 },
  { key: "construct", prob: 1 },
];

export const INIT_NUMBER_LITERAL_PROBS = [
  { key: "0", prob: 0 },
  { key: "1", prob: 1 },
];

export const INIT_BOOL_LITERAL_PROBS = [
  { key: "True", prob: 0.5 },
  { key: "False", prob: 1 },
];

export const INIT_NUMBER_BINOP_PROBS = [
  { key: "Plus", prob: 0.2 },
  { key: "Minus", prob: 0.4 },
  { key: "Mul", prob: 0.6 },
  { key: "IDiv", prob: 0.8 },
  { key: "Mod", prob: 1 },
];

export const INIT_BOOL_BINOP_PROBS = [
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

export const INIT_NEW_PROBS = [
  { key: "new", prob: 0.1 },
  { key: "existing", prob: 1 },
];

export const INIT_NEW_CLASS_PROBS = [
  { key: "new", prob: 0.8 },
  { key: "existing", prob: 1 },
];

export const INIT_CORRECT_PROBS = [
  { key: "correct", prob: 1 },
  { key: "incorrect", prob: 1 }, //start by generating only correct statements
];

export function selectFromProbTable(probTable: Array<ProbPair>): string {
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
