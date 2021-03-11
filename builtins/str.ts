// -*- mode: typescript; typescript-indent-level: 2; -*-

import * as cmn from "../common";

const lower32Mask = ((BigInt(1)<<BigInt(32)) - BigInt(1));

export function isChar(ptr: bigint): boolean {
  return (ptr >> BigInt(32)) == (cmn.CHAR_BI >> BigInt(32));
}

export function str_fromInt(importObject: any): any {
  return (num: any): any => {
    const jsStr = Number(num).toString();
    const resultStr = Number(importObject.imports.malloc(jsStr.length + 1));
    const memUint8 = importObject.imports.get_uint8_repr();
    
    var iter = 0;
    while (iter < jsStr.length) {
      memUint8[iter + resultStr] = jsStr.charCodeAt(iter);
      iter += 1;
    }
    memUint8[iter + resultStr] = 0;

    return cmn.STR_BI + BigInt(resultStr);
  };
}

export function str_in(importObject: any, not_in: boolean = false) {
  return (offBigInt1: any, offBigInt2: any): any => {
    const off1: number = Number(offBigInt1 & lower32Mask);
    const off2: number = Number(offBigInt2 & lower32Mask);

    const memUint8 = importObject.imports.get_uint8_repr();
    
    // Copy the first and second strings
    var siter1: number = off2;
    var siter2: number = off1;

    var str1 = "";
    var str2 = "";
    
    while (memUint8[siter1] != 0) {
      str1 = str1 + String.fromCharCode(memUint8[siter1]);
      siter1 += 1;
      if (isChar(offBigInt1))
	break;
    }
    
    while (memUint8[siter2] != 0) {
      str2 = str2 + String.fromCharCode(memUint8[siter2]);
      siter2 += 1;
      if (isChar(offBigInt2))
	break;
    }

    // Return pointer to the new string
    if (not_in) {
      return !str1.includes(str2) ? cmn.TRUE_BI : cmn.FALSE_BI;
    } else {
      return str1.includes(str2) ? cmn.TRUE_BI : cmn.FALSE_BI;
    }
  };
}

export function str_concat(importObject: any) {
  return (offBigInt1: any, offBigInt2: any): any => {
    const off1: number = Number(offBigInt1 & lower32Mask);
    const off2: number = Number(offBigInt2 & lower32Mask);

    const len1: number = Number(importObject.imports.str_len(offBigInt1));
    const len2: number = Number(importObject.imports.str_len(offBigInt2));

    // TODO: Set correct length here and in other places
    const newLen = len1 + len2 + 1;

    const heapPtr = Number(importObject.imports.malloc(newLen));
    const memUint8 = importObject.imports.get_uint8_repr();
    
    // Copy the first and second strings
    var diter: number = heapPtr;
    var siter: number = off1;

    while (siter < off1 + len1) {
      memUint8[diter] = memUint8[siter];
      siter += 1;
      diter += 1;
      if (isChar(offBigInt1))
	break;
    }
    
    siter = off2;
    while (siter < off2 + len2) {
      memUint8[diter] = memUint8[siter];
      siter += 1;
      diter += 1;
      if (isChar(offBigInt2))
	break;
    }
    memUint8[diter] = 0; // Add the final null char

    // Return pointer to the new string
    return cmn.STR_BI + BigInt(heapPtr);
  };
}

export function str_len(importObject: any) {
  return (offBigInt: any): any => {
    const off: number = Number(offBigInt & lower32Mask);

    if (isChar(offBigInt))
      return BigInt(1);
    
    const memBuffer: ArrayBuffer = (importObject as any).js.memory.buffer;
    const memUint8 = new Uint8Array(memBuffer);

    var iter = off;
    while (memUint8[iter] != 0) {
      iter += 1;
    }

    return BigInt(iter - off);
  };
}

export function str_mult(importObject: any) {
  return (str: any, times: any): any => {
    const strLen: number = Number(importObject.imports.str_len(str));
    const strOff: number = Number(str & lower32Mask);
    
    const newLen: number = strLen * Number(times) + 1;

    const newStr = Number(importObject.imports.malloc(newLen));
    const memUint8 = importObject.imports.get_uint8_repr();
    
    var iter = 0;
    while (iter < times) {

      var strIter = 0;

      while (strIter < strLen) {
	memUint8[newStr + iter*strLen + strIter] = memUint8[strOff + strIter];
	strIter += 1;
	if (isChar(str))
	  break;
      }
      iter += 1;
    }

    return BigInt(newStr) + cmn.STR_BI;
  };
}

export function str_slice(importObject: any) {
  return (str: any, arg1: any, arg2: any, arg3: any, explicitArgs: any): any => {
    const strOff: number = Number(str & lower32Mask);
    const strLen: number = Number(importObject.imports.str_len(str));
    const memUint8 = importObject.imports.get_uint8_repr();

    const getSign  = (arg: any) => { return Number(arg)/Math.abs(Number(arg)); }
    const arg1Sign = getSign(arg1);
    const arg2Sign = (arg2 != cmn.NONE_BI) ? getSign(arg2) : 1;
    const arg3Sign = (arg3 != cmn.NONE_BI) ? getSign(arg3) : 1;
    
    
    /* Add the missing arguments */
    if (arg1 == cmn.NONE_BI && explicitArgs > 1) {
      if (arg3Sign == 1) {
	arg1 = 0;
      } else {
	arg1 = BigInt(-1);
      }
    }

    var arg2WasMissing = false;

    if (arg2 == cmn.NONE_BI && explicitArgs > 1) {
      if (arg3Sign == 1) {
	arg2 = BigInt(strLen);
      } else {
	arg2 = BigInt(0);
	arg2WasMissing = true;
      }
    } 

    /* Copy the first and second strings */
    var siter: number = strOff + (strLen + Number(arg1))%strLen;

    var end = siter + 1;
    var step = 1;

    
    // Fix out of bound index
    if (Math.abs(Number(arg1)) > strLen) {
      arg1 = BigInt(strLen) * BigInt(arg1Sign);
    }
    
    if (arg2 != cmn.NONE_BI) {
      // Fix out of bound index
      if (Math.abs(Number(arg2)) > strLen) {
	arg2 = BigInt(strLen) * BigInt(arg2Sign);
      }	

      if (arg1Sign == arg2Sign && Number(arg1) > Number(arg2)) {
	/* Invalid bound, return empty string */
	end = siter;
      }

      if (Number(arg2) > 0) {
	end = strOff + Number(arg2);
	if (end > strOff + strLen) {
	  end = strOff + strLen;
	}
      } else {
	end = strOff + (strLen + Number(arg2))%strLen;
      }
    }

    if (arg3 != cmn.NONE_BI) {
      step = Number(arg3);
    }
    
    const resultOff = Number(importObject.imports.malloc(Math.abs(end-siter)+2));
    var diter: number = resultOff;

    var result = "";
    while ((step > 0 && siter < end) || (step < 0 && siter > end && !arg2WasMissing) || (step < 0 && siter >= end && arg2WasMissing)) {
      memUint8[diter] = memUint8[siter];
      result = result + String.fromCharCode(memUint8[diter]);
      siter += step;
      diter += 1;
    }
    
    memUint8[diter] = 0;

    // console.warn(`Slicing result: ${result} at offset ${resultOff}`);

    // Return pointer to the new string
    return cmn.STR_BI + BigInt(resultOff);
  };    
}

function str_op(importObject: any, op: any, start: any) {
  return (offBigInt1: any, offBigInt2: any): any => {
    var singleChar1 = false, singleChar2 = false;
    
    if (offBigInt1 >> BigInt(32) == cmn.CHAR_BI >> BigInt(32)) {
      singleChar1 = true;
    }

    if (offBigInt2 >> BigInt(32) == cmn.CHAR_BI >> BigInt(32)) {
      singleChar2 = true;
    }
    
    const off1: number = Number(offBigInt1 & lower32Mask);
    const off2: number = Number(offBigInt2 & lower32Mask);

    const memUint8 = importObject.imports.get_uint8_repr();
    
    // Copy the first and second strings
    var siter1: number = off1;
    var siter2: number = off2;

    var str1 = "";
    var str2 = "";

    // cmn.dumpMem(memUint8);
    
    while (memUint8[siter1] != 0) {
      str1 = str1 + String.fromCharCode(memUint8[siter1]);
      siter1 += 1;

      if (singleChar1)
	break;
    }
    
    while (memUint8[siter2] != 0) {
      str2 = str2 + String.fromCharCode(memUint8[siter2]);
      siter2 += 1;
      
      if (singleChar2)
	break;
    }

    // console.warn(`Comparing strings |${str1}| with |${str2}|`);

    return (op(str1, str2) ? cmn.TRUE_BI : cmn.FALSE_BI);
  };
}


export function str_le(importObject: any) {
  return str_op(importObject, (arg1:any, arg2:any) => {return arg1 <= arg2}, true);
}
export function str_lt(importObject: any) {
  return str_op(importObject, (arg1:any, arg2:any) => {return arg1 < arg2}, true);
}
export function str_ge(importObject: any) {
  return str_op(importObject, (arg1:any, arg2:any) => {return arg1 >= arg2}, true);
}
export function str_gt(importObject: any) {
  return str_op(importObject, (arg1:any, arg2:any) => {return arg1 > arg2}, false);
}
export function str_eq(importObject: any) {
  return str_op(importObject, (arg1:any, arg2:any) => {return arg1 == arg2}, true);
}
export function str_neq(importObject: any) {
  return str_op(importObject, (arg1:any, arg2:any) => {return arg1 != arg2}, false);
}

export function str_transform_op(importObject: any, charop: any) {
  return (str: any): any => {
    const strLen: number = Number(importObject.imports.str_len(str));
    const strOff: number = Number(str & lower32Mask);
    
    const newLen: number = strLen + 1;

    const newStr = Number(importObject.imports.malloc(newLen));
    const memUint8 = importObject.imports.get_uint8_repr();
    
    var siter = strOff;
    var diter = newStr;

    while (memUint8[siter] != 0) {
      memUint8[diter] = charop(String.fromCharCode(memUint8[siter])).charCodeAt(0);
      siter += 1;
      diter += 1;
      if (isChar(str))
	break;
    }

    memUint8[siter] = 0;

    return BigInt(newStr) + cmn.STR_BI;
  };
}

export function str_upper(importObject: any) {
  return str_transform_op(importObject, (str: string): string => {return str.toUpperCase()});
}

export function str_lower(importObject: any) {
  return str_transform_op(importObject, (str: string): string => {return str.toLowerCase()});
}

