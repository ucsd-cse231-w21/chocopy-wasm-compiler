/*
referrence: https://docs.python.org/3/library/exceptions.html
Use instanceof to get additional properties of each Error type, if necessary.

+-- InternalException -> This error is used for debugging in compiler, should not show up.

+-- RuntimeError (DynamicError)
		+-- StopInteration
		+-- ArithmeticError
    |   +-- OverflowError
    |   +-- ZeroDivisionError
		+-- LookupError
    |   +-- IndexError
    |   +-- KeyError
		+-- MemoryError
		+-- RecursionError
    +-- ValueError
    |   +-- UnicodeError

+-- CompileError  (StaticError)
    +-- AttributeError
    +-- NameError
    |   +-- UnBoundLocalError
    +-- SyntaxError
    |   +-- IndentationError
    +-- TypeError
    |		+-- UnsupportedOperandTypeError -> This error class is for TypeError related to operator like + - // * ....
		|		+-- TypeMismatchError -> This error class is for TypeError that is allowed in Python but not in our project
		|		+-- ConditionTypeError -> This error class is for condition type check in while and if, which does not exist in real python.
*/

import { BinOp, UniOp, Location, Type } from "./ast";

// I ❤️ TypeScript: https://github.com/microsoft/TypeScript/issues/13965
export class InternalException extends Error {
  __proto__: Error;

  constructor(message?: string, name = "InternalExpcetion") {
    const trueProto = new.target.prototype;
    super(message);
    this.name = name;

    // Alternatively use Object.setPrototypeOf if you have an ES6 environment.
    this.__proto__ = trueProto;
  }
}

export class RuntimeError extends Error {
  __proto__: Error;
  callStack: Array<Location>;

  constructor(callStack: Array<Location>, message?: string, name = "RuntimeError") {
    const trueProto = new.target.prototype;
    super(message);
    this.name = name;
    this.callStack = callStack;

    // Alternatively use Object.setPrototypeOf if you have an ES6 environment.
    this.__proto__ = trueProto;
  }
}

export class CompileError extends Error {
  __proto__: Error;
  callStack: Array<Location>;

  constructor(callStack: Array<Location>, message?: string, name = "CompileError") {
    const trueProto = new.target.prototype;
    super(message);
    this.name = name;
    this.callStack = callStack;

    // Alternatively use Object.setPrototypeOf if you have an ES6 environment.
    this.__proto__ = trueProto;
  }
}

export class StopIteration extends RuntimeError {
  constructor(callStack: Array<Location>, message?: string) {
    super(callStack, message, "StopIteration");
  }
}

export class ArithmeticError extends RuntimeError {
  constructor(callStack: Array<Location>, message?: string, name = "ArithmeticError") {
    super(callStack, message, name);
  }
}

// e.g. math.exp(1000)
export class OverflowError extends ArithmeticError {
  constructor(callStack: Array<Location>, message?: string) {
    super(callStack, message, "OverflowError");
  }
}

// e.g. 7/0
export class ZeroDivisionError extends ArithmeticError {
  constructor(callStack: Array<Location>, message = "division by zero") {
    super(callStack, message, "ZeroDivisionError");
  }
}

export class LookupError extends RuntimeError {
  constructor(callStack: Array<Location>, message?: string, name = "LookupError") {
    super(callStack, message, name);
  }
}

// If an index is not an integer, TypeError is raised.
export class IndexError extends LookupError {
  constructor(callStack: Array<Location>, message = "list index out of range") {
    super(callStack, message, "IndexError");
  }
}

export class KeyError extends LookupError {
  constructor(callStack: Array<Location>) {
    super(callStack, ``, "KeyError");
  }
}

export class MemoryError extends RuntimeError {
  constructor(callStack: Array<Location>, message?: string) {
    super(callStack, message, "MemoryError");
  }
}

export class NameError extends CompileError {
  varName: string;
  constructor(callStack: Array<Location>, varName: string, name = "NameError") {
    super(callStack, `name '${varName}' is not defined`, name);
    this.varName = varName;
  }
}

export class UnboundLocalError extends NameError {
  varName: string;
  constructor(callStack: Array<Location>, varName: string) {
    super(
      callStack,
      `local variable '${varName}' referenced before assignment`,
      "UnboundLocalError"
    );
    this.varName = varName;
  }
}

export class RecursionError extends RuntimeError {
  constructor(callStack: Array<Location>) {
    super(callStack, "maximum recursion depth exceeded", "RecursionError");
  }
}

export class SyntaxError extends CompileError {
  constructor(callStack: Array<Location>, message?: string, name = "SyntaxError") {
    super(callStack, message == undefined ? `invalid syntax` : message, name);
  }
}

export class IndentationError extends SyntaxError {
  constructor(callStack: Array<Location>, message = `unexpected indent`) {
    super(callStack, message, "IndentationError");
  }
}

export class TypeError extends CompileError {
  constructor(callStack: Array<Location>, message?: string, name = "TypeError") {
    super(callStack, message, name);
  }
}

export class TypeMismatchError extends TypeError {
  expect: Type[];
  got: Type[];
  constructor(
    callStack: Array<Location>,
    expect: Type | Type[],
    got: Type | Type[],
    name = "TypeMismatchError"
  ) {
    if (Array.isArray(expect)) {
      super(
        callStack,
        `Expected type '${expect
          .map((s) => typeToString(s))
          .join(", ")}';  got type '${(got as Type[]).map((s) => typeToString(s)).join(", ")}'`,
        name
      );
      this.expect = expect;
      this.got = got as Type[];
    } else {
      super(
        callStack,
        `Expected type '${typeToString(expect)}'; got type '${typeToString(got as Type)}'`,
        name
      );
      this.expect = [expect];
      this.got = [got as Type];
    }
  }
}

export class UnsupportedOperandTypeError extends TypeError {
  op: BinOp | UniOp;
  oprand: Type[];
  constructor(callStack: Array<Location>, op: BinOp | UniOp, operand: Type[], name = "TypeError") {
    if (operand.length == 1)
      super(
        callStack,
        `unsupported operand type(s) for ${UniOp[op]}: '${typeToString(operand[0])}'`,
        name
      );
    else
      super(
        callStack,
        `unsupported operand type(s) for ${BinOp[op]}: '${typeToString(
          operand[0]
        )}' and '${typeToString(operand[1])}'`,
        name
      );
  }
}

export class ConditionTypeError extends TypeError {
  type: Type;
  constructor(callStack: Array<Location>, got: Type) {
    super(
      callStack,
      `Condition Expression Cannot be of type '${typeToString(got)}'`,
      "ConditionTypeError"
    );
    this.type = got;
  }
}

// If an object does not support attribute references or attribute assignment at all, TypeError is raised.
export class AttributeError extends RuntimeError {
  obj: Type;
  attr: string;
  constructor(callStack: Array<Location>, obj: Type, attr: string) {
    var message = `'${obj.tag == "class" ? obj.name : obj.tag}' object has no attribute '${attr}'`;
    super(callStack, message, "AttributeError");
    this.obj = obj;
    this.attr = attr;
  }
}

export class ValueError extends RuntimeError {
  constructor(callStack: Array<Location>, message?: string, name = "ValueError") {
    super(callStack, message, name);
  }
}

export class UnicodeError extends ValueError {
  constructor(callStack: Array<Location>, codec: string, character: string, pos: number) {
    super(
      callStack,
      `'${codec}' codec can't encode character '${character}' in position ${pos}`,
      "UnicodeError"
    );
  }
}

function typeToString(typ: Type): string {
  switch (typ.tag) {
    case "callable":
      return `[[${typ.args.toString()}], ${typ.ret}]`;
    case "class":
      return typ.name;
    case "list":
      return typeToString(typ.content_type);
    default:
      return typ.tag;
  }
}
