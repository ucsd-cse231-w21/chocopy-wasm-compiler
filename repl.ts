// -*- mode: typescript; typescript-indent-level: 2; -*-

import { run } from "./runner";
import { typecheck_ } from "./compiler";
import { GlobalEnv } from "./env";
import { Value, Type, BoolT, IntT, NoneT, StrT } from "./ast";
import { valueToStr, i64ToValue, NONE_BI, STR_BI, TRUE_BI, FALSE_BI } from "./common";
import * as compiler from './compiler';
import * as err from './error';

interface REPL {
  run(source : string) : Promise<any>;
}

export class BasicREPL {
  currentEnv: GlobalEnv
  importObject: any
  memory: any
  newlyConstructed: boolean
  constructor(importObject : any) {
    compiler.reset();
    this.newlyConstructed = true;
    this.importObject = importObject;
    this.importObject.nameMap = new Array<string>();
    this.importObject.tableOffset = new Map<number, string>();
      
    this.importObject.updateNameMap = (env : GlobalEnv) => {
        env.globals.forEach((pos, name) => {
          importObject.nameMap[pos[1]] = name;
        })
    };
      
    this.importObject.updateTableMap = (env : GlobalEnv) => {
      env.classes.forEach((val, key) => {
	console.log("setting tableOffset");
        importObject.tableOffset.set(val.tableOff, key);
      })
    };

    this.importObject.imports.print_other = (arg: any) => {
      const res = i64ToValue(arg, this.importObject.tableOffset);
      if (res.tag == "bool") {
	importObject.imports.print_bool(res.value);
	return NONE_BI;
      } else if (res.tag == "num") {
	const typ: Type = {tag: "number"};
	const val = res.value;
	importObject.imports.print_num(val);
	return NONE_BI;
      } else if (res.tag == "str") {
	return importObject.imports.print_str(res.off);
      } else if (res.tag == "char") {
	return importObject.imports.print_char(res.off);
      } else if (res.tag == "none") {
	importObject.imports.print_none(undefined);
      } else {
	importObject.imports.print({tag: res.tag} , undefined);
	return NONE_BI;
      }
    };


    this.importObject.imports.print_str = (off: number) => {
      const memBuffer: ArrayBuffer = (importObject as any).js.memory.buffer;
      const memUint8 = new Uint8Array(memBuffer);
      
      var iter = off;
      var str = "";
      var isEscaped = false;
      while (memUint8[iter] != 0) {
	const nextChar = String.fromCharCode(memUint8[iter]);

	if (isEscaped) {
	  switch (nextChar) {
	    case "t":
	      str = str.concat("    ");
	      break;
	    case "\\":
	      str = str.concat("\\");
	      break;
	    case "n":
	      str = str.concat("\n");
	      break;
	    case "\"":
	      str = str.concat(`"`);
	      break;
	    case "'":
	      str = str.concat(`'`);
	      break;
	  }
	  isEscaped = false;
	} else if (nextChar == "\\") {
	  isEscaped = true;
	} else {
	  str = str.concat(nextChar);
	}
	
	iter += 1;
      }

      const typ: Type = {tag: "str"};
      importObject.imports.print_txt(str);

      return NONE_BI;	  
    },

    this.importObject.imports.print_obj = (arg : any, classId: any) => {
      const classObj: Value = {tag: "object", name: importObject.tableOffset.get(Number(classId)), address: arg};
      
      return importObject.imports.print({tag: "class", name: classObj.name}, undefined);
    };

    this.importObject.imports.print_char = (off: any) => {
      const memBuffer: ArrayBuffer = (importObject as any).js.memory.buffer;
      const memUint8 = new Uint8Array(memBuffer);
      
      const nextChar = String.fromCharCode(memUint8[off]);

      const typ: Type = {tag: "str"};
      importObject.imports.print_txt(nextChar);

      return NONE_BI;
    }
    
    this.importObject.imports.assert_non_none = (arg : any): any => {
      const res = i64ToValue(arg, this.importObject.tableOffset);
      if (res.tag == "none") {
	throw new Error("Operation on None");
      }
      return arg;      
    };

    this.importObject.imports.str_len = (offBigInt: any): any => {
      const off: number = Number(offBigInt - STR_BI);
      
      const memBuffer: ArrayBuffer = (importObject as any).js.memory.buffer;
      const memUint8 = new Uint8Array(memBuffer);
      
      var iter = off;
      while (memUint8[iter] != 0) {
	iter += 1;
      }

      return BigInt(iter - off);
    };

    this.importObject.imports.get_uint8_repr = (): any => {
      const memBuffer: ArrayBuffer = (importObject as any).js.memory.buffer;
      const memUint8 = new Uint8Array(memBuffer);
      
      return memUint8;
    }
    
    this.importObject.imports.str_concat = (offBigInt1: any, offBigInt2: any): any => {
      const off1: number = Number(offBigInt1 - STR_BI);
      const off2: number = Number(offBigInt2 - STR_BI);

      const len1: number = Number(importObject.imports.str_len(offBigInt1));
      const len2: number = Number(importObject.imports.str_len(offBigInt2));
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
      }
      
      siter = off2;
      while (siter < off2 + len2) {
	memUint8[diter] = memUint8[siter];
	siter += 1;
	diter += 1;
      }
      memUint8[diter] = 0; // Add the final null char

      console.log(`allocated string at ${heapPtr} of length ${newLen}`);

      // Return pointer to the new string
      return STR_BI + BigInt(heapPtr);
    };

    this.importObject.imports.str_eq = (offBigInt1: any, offBigInt2: any): any => {
      const lower32Mask = ((BigInt(1)<<BigInt(32)) - BigInt(1));
      const off1: number = Number(offBigInt1 & lower32Mask);
      const off2: number = Number(offBigInt2 & lower32Mask);

      const memUint8 = importObject.imports.get_uint8_repr();
      
      // Copy the first and second strings
      var siter1: number = off1;
      var siter2: number = off2;

      var result = true;
      
      while (memUint8[siter1] != 0 && memUint8[siter2] != 0) {
	if (memUint8[siter1] != memUint8[siter2]) {
	  result = false;
	  break;
	}	
	siter1 += 1;
	siter2 += 1;
      }

      return (result ? TRUE_BI : FALSE_BI);
    }

    this.importObject.imports.str_neq = (offBigInt1: any, offBigInt2: any): any => {
      const result = importObject.imports.str_eq(offBigInt1, offBigInt2);

      return result == TRUE_BI ? FALSE_BI : TRUE_BI;
    }

    // Returns the offset to the newly allocated memory region
    this.importObject.imports.malloc = (bytes: any): any => {
      const memBuffer: ArrayBuffer = (importObject as any).js.memory.buffer;
      const memUint8 = new Uint8Array(memBuffer);
      const memUint64 = new BigUint64Array(memBuffer);
      
      // Get the current heap pointer
      const heapPtrBuffer = importObject.js.memory.buffer.slice(0, 8);
      const heapPtrDV = new DataView(heapPtrBuffer, 0, 8);
      const heapPtr = Number(heapPtrDV.getBigUint64(0, true));

      // Write the new heap pointer
      memUint64[0] = BigInt(heapPtr + bytes);

      return BigInt(heapPtr);
    }

    this.importObject.imports.str_mult = (str: any, times: any): any => {
      const strLen: number = Number(importObject.imports.str_len(str));
      const strOff: number = Number(str - STR_BI);
      
      const newLen: number = strLen * Number(times) + 1;

      const newStr = Number(importObject.imports.malloc(newLen));
      const memUint8 = importObject.imports.get_uint8_repr();
      
      var iter = 0;
      while (iter < times) {

	var strIter = 0;

	while (strIter < strLen) {
	  memUint8[newStr + iter*strLen + strIter] = memUint8[strOff + strIter];
	  strIter += 1;
	}
	iter += 1;
      }

      return BigInt(newStr) + STR_BI;
    }
    
    // "adlkjfs"[1:2:1]
    this.importObject.imports.str_slice = (str: any, arg1: any, arg2: any, arg3: any): any => {
      const strOff: number = Number(str - STR_BI);
      const strLen: number = Number(importObject.imports.str_len(str));

      if (Number(arg1) >= strLen || Number(arg1) <= -strLen) {
	err.idxError({line:0, col:0, len:0}, `Index ${arg1} out of range, string length ${strLen}.`, "");
      }

      const memUint8 = importObject.imports.get_uint8_repr();

      // Copy the first and second strings
      var siter: number = strOff + (strLen + Number(arg1))%strLen;

      var end = siter + 1;
      var step = 1;
      
      if (arg2 != NONE_BI) {
	if (Number(arg2) > 0) {
	  end = strOff + Number(arg2);
	  if (end > strOff + strLen) {
	    end = strOff + strLen;
	  }
	} else {
	  end = strOff + (strLen + Number(arg2))%strLen;
	}
      }

      if (arg3 != NONE_BI) {
	step = Math.abs(Number(arg3));
      }
      
      const resultOff = Number(importObject.imports.malloc(end-siter));
      var diter: number = resultOff;

      while (siter < end) {
	memUint8[diter] = memUint8[siter];
	siter += step;
	diter += 1;
      }
      
      memUint8[diter] = 0;

      // Return pointer to the new string
      return STR_BI + BigInt(resultOff);
    };    
    
    if(!importObject.js || this.newlyConstructed) {
      console.log("Constructing new js object");
      const memory = new WebAssembly.Memory({initial:10, maximum:2000});
      const table = new WebAssembly.Table({element: "anyfunc", initial: 10});
      this.importObject.js = { memory: memory, table: table };
      this.newlyConstructed = false;
    }
    this.currentEnv = {
      globals: new Map(),
      globalStrs: new Map(),
      classes: new Map(),
      funcs: new Map([['print', { name: "print", members: [NoneT], retType: IntT}],
		      ['len', { name: "len", members: [StrT], retType: IntT}],
		     ]),
      offset: 8,
      classOffset: 0
    };
  }
  async run(source : string) : Promise<[Value, string]> {
    this.importObject.updateNameMap(this.currentEnv); // is this the right place for updating the object's env?
    this.importObject.updateTableMap(this.currentEnv);
    const [result, newEnv, compiled] = await run(source, {importObject: this.importObject, env: this.currentEnv});
    this.currentEnv = newEnv;
    console.log("returning");
    console.log(result);
    return [result, compiled];
  }

  async tc(source : string) : Promise<Type> {
    return typecheck_(source, this.currentEnv);
  }
}
