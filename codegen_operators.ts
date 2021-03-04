// -*- mode: typescript; typescript-indent-level: 2; -*-

import * as cmn from "./common";
import { Type } from "./ast";

export function codeGenUOp(uop: string) : Array<string> {
  switch (uop) {
    case "-":
      return [`(i64.const -1)`,
	      `(i64.mul)`]
    case "not":
      return [`(i64.const 1)`,
	      `(i64.add)`,
	      `(i64.const 18446744073709551613)`, // Reset bit at pos 1 { ((1<<64)-1)-2 }
	      `(i64.and)`
	     ]
  }
}

export function codeGenStrAdd() : Array<string> {
  var result: Array<string> = [];

  result.push(`(call $str$concat)`);
  
  return result;
}

export function codeGenAdd(op: string, leftT: Type, rightT: Type) : Array<string> {
  if (leftT.tag == "str" && rightT.tag == "str") {
    return codeGenStrAdd();
  } else {
    return [`(i64.add)`];
  }
}

export function codeGenEquality(op: string, leftT: Type, rightT: Type): Array<string> {
  if (leftT.tag == "str" && rightT.tag == "str") {
    return [`(call $str$eq)`];
  } else {
    return [`(i64.eq)`,
	    `(i64.extend_i32_s)`,
	    `(i64.const 1)`,
	    `(i64.const 62)`,
	    `(i64.shl)`,
	    `(i64.add)`];
  } 
}

export function codeGenInequality(op: string, leftT: Type, rightT: Type): Array<string> {
  if (leftT.tag == "str" && rightT.tag == "str") {
    return [`(call $str$neq)`];
  } else {
      return [`(i64.ne)`,
	      `(i64.extend_i32_s)`,
	      `(i64.const 1)`,
	      `(i64.const 62)`,
	      `(i64.shl)`,
	      `(i64.add)`];
  }
}

export function codeGenMult(op: string, leftT: Type, rightT: Type): Array<string> {
  if (leftT.tag == "str") {
    return [`(call $str$mult)`];
  } else {
    return [`(i64.mul)`];
  }
}

export function codeGenOp(op: string, leftT: Type, rightT: Type) : Array<string> {
  switch (op) {
    case "+":
      return codeGenAdd(op, leftT, rightT);
    case "-":
      return [`(i64.sub)`];
    case "*":
      return codeGenMult(op, leftT, rightT);
    case ">":
      return [`(i64.gt_s)`, `(i64.extend_i32_s)`];
    case "<":
      return [`(i64.lt_s)`, `(i64.extend_i32_s)`];
    case "<=":
      return [`(i64.le_s)`, `(i64.extend_i32_s)`];
    case ">=":
      return [`(i64.ge_s)`, `(i64.extend_i32_s)`];
    case "//":
      return [`(i64.div_s)`];
    case "%":
      return [`(i64.rem_s)`]
    case "and":
      return [`(i64.const ${cmn.TRUE_VAL})`,
	      `(i64.eq)`,
	      `(i64.extend_i32_s)`,
	      `(i64.sub)`,
	      `(i64.const ${cmn.FALSE_VAL})`,
	      `(i64.eq)`,
	      `(i64.extend_i32_s)`,
	      `(i64.const ${cmn.FALSE_VAL})`,
	      `(i64.add)`];
    case "or":
      return [`(i64.rem_s)`]
    case "==":
      return codeGenEquality(op, leftT, rightT);
    case "!=":
      return codeGenInequality(op, leftT, rightT);
    case "is":
      return [`(i64.sub)`,
	      `(i64.const 32)`,
	      `(i64.shr_u)`,
	      `(i64.const 0)`,
	      `(i64.eq)`,
	      `(i64.extend_i32_s)`,
	      `(i64.const 1)`,
	      `(i64.const 62)`,
	      `(i64.shl)`,
	      `(i64.add)`
	     ];
  }
}
