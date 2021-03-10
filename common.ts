// -*- mode: typescript; typescript-indent-level: 2; -*-

import { Type, NoneT, IntT, BoolT, StrT, Value } from "./ast";
import { valError, dummyPos } from "./error";

export const TRUE_VAL  = "4611686018427387905"; // (1<<62)+1
export const FALSE_VAL = "4611686018427387904"; // 1<<62
export const NONE_VAL  = "2305843009213693952"; // 1<<61
export const PTR_VAL   = "1152921504606846976"; // 1<<60
export const STR_VAL   =  "576460752303423488"; // 1<<59
export const CHAR_VAL  =  "288230376151711744"; // 1<<58

export const FALSE_BI = BigInt(1) << BigInt(62);
export const TRUE_BI  = FALSE_BI + BigInt(1);
export const NONE_BI  = BigInt(1) << BigInt(61);
export const PTR_BI   = BigInt(1) << BigInt(60);
export const STR_BI   = BigInt(1) << BigInt(59);
export const CHAR_BI  = BigInt(1) << BigInt(58);

export function dumpMem(memUint8: Uint8Array, from: number = 0, to: number = 10) {
  var i = from;
  while (i < to) {
    var fmt = "";
    var j = 0;
    
    while (j < 8) {
      fmt += (memUint8[i*8 + j]).toString(16).padStart(2, '0') + " ";
      j += 1;
    }

    fmt += "\t";

    var j = 0;
    
    while (j < 8) {
      var repr: string = "";
      const charCode = memUint8[i*8 + j];

      if (charCode <= 126 && charCode >= 32) {
	repr = String.fromCharCode(charCode);
      } else {
	repr = ".";
      }
      
      if (repr.length == 0) {
	repr += " ";
      }
		  
      fmt += repr + " ";
      j += 1;
    }

    console.log(`${(i*8).toString().padStart(3, '0')}: ${fmt}`);
    i+=1;
  }
}

export function i64ToValue(val: any, classMap: Map<number, string> = new Map()): Value {
  if (val == undefined) {
    console.log("Input undefined, returning undefined");
    return undefined;
  }
  
  const bigVal = BigInt(val);
  const upper32 = bigVal >> BigInt(32);
  const lower32 = bigVal & ((BigInt(1) << BigInt(32)) - BigInt(1));
  
  var result: Value = undefined;
  switch (bigVal) {
    case FALSE_BI:
      result = { tag: "bool", value: false };
      break;
    case TRUE_BI:
      result = { tag: "bool", value: true };
      break;
    case NONE_BI:
      result = { tag: "none" };
      break;
    default:
      switch (upper32) {
	case (PTR_BI >> BigInt(32)):
	  const classNameRef = classMap.get(Number(lower32));
	  const className = classNameRef == undefined ? "unknown" : classNameRef;
	  
	  result = { tag: "object", name: className, address: Number(lower32) };
	  break;
	case (STR_BI >> BigInt(32)):
	  result = { tag: "str", off: Number(lower32) };
	  break;
	case (CHAR_BI >> BigInt(32)):
	  result = { tag: "char", off: Number(lower32) };
	  break;
	default:
	  if (upper32 != BigInt(0) && (upper32 + BigInt(1)) != BigInt(0)) {
	    valError(dummyPos, `[PTR_BI = ${(PTR_BI>>BigInt(32)).toString(2)}] Unknown value ${val}, upper32: ${upper32.toString(2)}, lower32: ${lower32.toString(2)}`, "");
	  }
	  result = { tag: "num", value: Number(bigVal) };
	  break;
      }
      break;
  }

  return result;
}

export function tr(type: Type): string {
  switch (type) {
    case NoneT:
      return "None";
    case IntT:
      return "int";
    case BoolT:
      return "bool";
    case StrT:
      return "string";
    default:
      if (type.tag == "class") {
	return `<${type.name}>`;
      }
      debugger;
      throw `Unable to translate type '${type}', called from ${tr.caller}`;
  }
}

export function eqT(type1: Type, type2: Type): boolean {
  if (type1.tag == type2.tag) {
    if (type1.tag == "class" && type2.tag == "class") {
      return type1.name == type2.name;
    } else {
      return true;
    }
  } else {
    return false;
  }
}

export function neqT(type1: Type, type2: Type): boolean {
  return !eqT(type1, type2);
}

export function canAssignNone(type1: Type): boolean {
  return type1.tag == "class" || type1.tag == "str";
}

export function strToType(str: string): Type {
  switch (str) {
    case "None":
      return NoneT;
    case "int":
      return IntT;
    case "bool":
      return BoolT;
    case "str":
      return StrT;
    default:
      throw `Can't translate type '${str}'`;
  }
}

export function valueToStr(arg: Value): string {
  if (arg == undefined)
    return undefined;
  
  switch (arg.tag) {
    case "bool":
      if (arg.value) {
	return "True";
      } else {
	return "False";
      }
    case "none":
      return `None`;
    case "str":
      return `string`;
    case "num":
      return `${arg.value}`;
    case "object":
      return `<${arg.name} ${arg.address}>`;
    default:
      throw `Can't translate`;
  }
}
