import * as BaseException from "./error";
import { Location } from "./ast";

export class ErrorManager {
  sources: Array<string>;
  callStack: Array<Location>;
  constructor() {
    this.sources = new Array<string>();
    this.callStack = new Array<Location>();
  }

  __pushStack(line: number, col: number, length: number, fileId: number) {
    this.callStack.push({ line: line, col, length, fileId });
    if (this.callStack.length >= 100) throw new BaseException.RecursionError(this.callStack);
  }

  __popStack() {
    this.callStack.pop();
  }

  locToString(loc: Location): string {
    console.log(this.sources[loc.fileId - 1].split(/\r?\n/)[loc.line - 1]);
    return this.sources[loc.fileId - 1]
      .split(/\r?\n/)
      [loc.line - 1].substr(loc.col, loc.col + loc.length)
      .split(".")[1];
  }

  stackToString(callStack: Array<Location>): string {
    var result = "";
    callStack.forEach((loc, i) => {
      if (i <= 10)
        result = `at line ${loc.line} of file ${loc.fileId}: ${
          this.sources[loc.fileId - 1].split(/\r?\n/)[loc.line - 1]
        }`
          .concat("\n")
          .concat(result);
    });
    return result;
  }

  clearStack() {
    this.callStack = new Array<Location>();
  }

  __checkNoneClass(arg: number) {
    if (arg == 0)
      throw new BaseException.AttributeError(
        this.callStack,
        { tag: "none" },
        this.locToString(this.callStack[this.callStack.length - 1])
      );
    console.log(arg);
  }

  __checkNoneLookup(arg: number) {
    if (arg == 0)
      throw new BaseException.TypeError(
        this.callStack,
        "'NoneType' object is not subscriptable or does not support item assignment"
      );
    console.log(arg);
  }

  __checkIndex(size: number, key: number) {
    console.log(key + " " + size);
    if (key < 0 || key >= size) throw new BaseException.IndexError(this.callStack);
  }

  __checkKey(key:number){
    console.log(key);
    if (key === -1) throw new BaseException.KeyError(this.callStack);
  }
}

export function importErrorManager(importObject: any, em: ErrorManager) {
  importObject.imports.__pushStack = (col: number, line: number, length: number, id: number) => {
    em.__pushStack(col, line, length, id);
  };

  importObject.imports.__popStack = () => {
    em.__popStack();
  };

  importObject.imports.__checkNoneClass = (arg: number) => {
    em.__checkNoneClass(arg);
  };

  importObject.imports.__checkNoneLookup = (arg: number) => {
    em.__checkNoneLookup(arg);
  };

  importObject.imports.__checkIndex = (size: number, id: number) => {
    em.__checkIndex(size, id);
  };

  importObject.imports.__checkKey = (key:number) =>{
    em.__checkKey(key)
  }
}

export enum RunTime {
  CHECK_NONE_CLASS = "check_none_class",
  CHECK_NONE_LOOKUP = "check_none_lookup",
  CHECK_ZERO_DIVISION = "check_division",
  CHECK_INDEX_ERROR = "check_index",
  CHECK_VALUE_ERROR = "check_value",
  CHECK_KEY_ERROR = "check_key",
}
