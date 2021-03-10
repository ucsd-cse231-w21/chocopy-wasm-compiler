import * as BaseException from "./error"
import { Location } from "./ast"

export class ErrorManager {
  sources: Array<string>;
  callStack: Array<Location>;
  constructor() {
    this.sources = new Array<string>();
    this.callStack = new Array<Location>();
  }


  __pushStack(line: number, col: number, length: number, fileId: number) {
    this.callStack.push({line: line, col, length, fileId});
    if (this.callStack.length >= 100) throw new BaseException.RecursionError(this.callStack);
  };

  __popStack() {
    this.callStack.pop();
  };
  
  locToString(loc: Location) : string {
    console.log(this.sources[loc.fileId - 1].split(/\r?\n/)[loc.line - 1]);
    return this.sources[loc.fileId - 1].split(/\r?\n/)[loc.line - 1].substr(loc.col, loc.col+ loc.length).split(".")[1];
  }

  stackToString(callStack: Array<Location> | Location) : string {
    var result = "";
    if (!Array.isArray(callStack)) {
      callStack = [callStack];
    }
    callStack.forEach((loc, i) => {
      if (i <= 10)
      result = (`at line ${loc.line} of file ${loc.fileId}: ${this.sources[loc.fileId - 1].split(/\r?\n/)[loc.line - 1]}`)
                      .concat("\n").concat(result);
    })
    return result;
  }

  clearStack() {
    this.callStack = new Array<Location>();
  }

  __checkNonPointer(arg: number) : number {
    console.log(arg);
    if (arg == 0) throw new BaseException.AttributeError(this.callStack, {tag: "none"}, this.locToString(this.callStack[this.callStack.length - 1]));
    return arg;
  };
}


export function importStackManager(importObject: any, em: ErrorManager) {
  importObject.imports.__pushStack = function (col: number, line: number, length: number, id: number) {
    em.__pushStack(col, line, length, id);
  }

  importObject.imports.__popStack = function () {
    em.__popStack();
  }

  importObject.imports.__checkNonPointer = function(arg: number) {
    em.__checkNonPointer(arg);
  }
}