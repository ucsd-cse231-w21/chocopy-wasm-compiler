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
    this.callStack.push({ line: line, col: col, length: length, fileId: fileId });
    if (this.callStack.length >= 100) throw new BaseException.RecursionError(this.callStack);
  }

  __popStack() {
    this.callStack.pop();
  }

  locToString(loc: Location): string {
    return this.sources[loc.fileId - 1]
      .split(/\r?\n/)
      [loc.line - 1].substr(loc.col - 1, loc.length);
  }

  stackToString(callStack: Array<Location>): string {
    var result = "";
    let previousCall = "main";
    callStack.forEach((loc, i) => {
      if (i <= 10) {
        result += `at line ${loc.line} of file ${loc.fileId} in ${previousCall} \n`;
        let file: string[] = this.sources[loc.fileId - 1].split(/\r?\n/);
        let fileLines = file.length;
        let start = Math.max(loc.line - 1, 1);
        let end =
          start == loc.line ? Math.min(loc.line + 2, fileLines) : Math.min(loc.line + 1, fileLines);
        for (let line = start; line <= end; line++) {
          result += (line === loc.line ? ` ----> ` : `       `) + `${line}\t`;
          result += file[line - 1] + "\n";
        }
        result += "\n";
        previousCall = this.locToString(loc);
      }
    });
    if (callStack.length > 10) result += "...";
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
        this.locToString(this.callStack[this.callStack.length - 1]).split(".")[1]
      );
  }

  __checkNoneLookup(arg: number) {
    if (arg == 0)
      throw new BaseException.TypeError(
        this.callStack,
        "'NoneType' object is not subscriptable or does not support item assignment"
      );
  }

  __checkIndex(size: number, key: number) {
    if (key < 0 || key >= size) throw new BaseException.IndexError(this.callStack);
  }

  __checkKey(key: number) {
    if (key === -1) throw new BaseException.KeyError(this.callStack);
  }

  __checkZeroDivision(key: number) {
    if (key == 0) throw new BaseException.ZeroDivisionError(this.callStack);
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

  importObject.imports.__checkKey = (key: number) => {
    em.__checkKey(key);
  };

  importObject.imports.__checkZeroDivision = (key: number) => {
    em.__checkZeroDivision(key);
  };
}

export enum RunTime {
  CHECK_NONE_CLASS = "check_none_class",
  CHECK_NONE_LOOKUP = "check_none_lookup",
  CHECK_ZERO_DIVISION = "check_division",
  CHECK_INDEX_ERROR = "check_index",
  CHECK_VALUE_ERROR = "check_value",
  CHECK_KEY_ERROR = "check_key",
}
