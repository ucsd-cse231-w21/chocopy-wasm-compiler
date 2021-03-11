// -*- mode: typescript; typescript-indent-level: 2; -*-

import * as cmn from "../common";
import * as err from "../error";

const lower32Mask = ((BigInt(1)<<BigInt(32)) - BigInt(1));

export function isChar(ptr: bigint): boolean {
  return (ptr >> BigInt(32)) == (cmn.CHAR_BI >> BigInt(32));
}

export function int_fromStr(importObject: any): any {
  return (str: any): any => {
    const off: number = Number(str & lower32Mask);

    const memUint8 = importObject.imports.get_uint8_repr();
    
    // Copy the first and second strings
    var siter: number = off;

    var strJs = "";
    while (memUint8[siter] != 0) {
      strJs = strJs + String.fromCharCode(memUint8[siter]);
      siter += 1;
      if (isChar(str))
	break;
    }

    try {
      return BigInt(strJs);
    } catch {
      err.argError(err.dummyPos, `Cannot converting '${strJs}' to an int`, ``);
    }
  };
}
