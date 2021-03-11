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

import { type } from "cypress/types/jquery";
import { stringInput } from "lezer-tree";
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
  // TODO - error-reporting
  // stacktrace for runtimeError
  constructor(message?: string, name = "RuntimeError") {
    const trueProto = new.target.prototype;
    super(message);
    this.name = name;

    // Alternatively use Object.setPrototypeOf if you have an ES6 environment.
    this.__proto__ = trueProto;
  }
}

export class CompileError extends Error {
  __proto__: Error;
  loc: Location;

  constructor(loc: Location, message?: string, name = "CompileError") {
    const trueProto = new.target.prototype;
    super(message);
    this.name = name;
    this.loc = loc;

    // Alternatively use Object.setPrototypeOf if you have an ES6 environment.
    this.__proto__ = trueProto;
  }
}

export class StopIteration extends RuntimeError {
  constructor(message?: string) {
    super(message, "StopIteration");
  }
}

export class ArithmeticError extends RuntimeError {
  constructor(message?: string, name = "ArithmeticError") {
    super(message, name);
  }
}

// e.g. math.exp(1000)
export class OverflowError extends ArithmeticError {
  constructor(message?: string) {
    super(message, "OverflowError");
  }
}

// e.g. 7/0
export class ZeroDivisionError extends ArithmeticError {
  constructor(message = "division by zero") {
    super(message, "ZeroDivisionError");
  }
}

// If an object does not support attribute references or attribute assignment at all, TypeError is raised.
export class AttributeError extends CompileError {
  obj: Type;
  attr: string;
  constructor(loc: Location, obj: Type, attr: string) {
    var message = `'${
      obj.tag == "class" ? obj.name : obj.tag
    }' object has no attribute '${attr}'`;
    super(loc, message, "AttributeError");
    this.obj = obj;
    this.attr = attr;
  }
}

export class LookupError extends RuntimeError {
  constructor(message?: string, name = "LookupError") {
    super(message, name);
  }
}

// If an index is not an integer, TypeError is raised.
export class IndexError extends LookupError {
  constructor(message = "list index out of range") {
    super(message, "IndexError");
  }
}

export class KeyError extends LookupError {
  constructor(keyName: string) {
    super(`'${keyName}'`, "KeyError");
  }
}

export class MemoryError extends RuntimeError {
  constructor(message?: string) {
    super(message, "MemoryError");
  }
}

export class NameError extends CompileError {
  varName: string;
  constructor(loc: Location, varName: string, name = "NameError") {
    super(loc, `name '${varName}' is not defined`, name);
    this.varName = varName;
  }
}

export class UnboundLocalError extends NameError {
  varName: string;
  constructor(loc: Location, varName: string) {
    super(
      loc,
      `local variable '${varName}' referenced before assignment`,
      "UnboundLocalError"
    );
    this.varName = varName;
  }
}

export class RecursionError extends RuntimeError {
  constructor() {
    super("maximum recursion depth exceeded", "RecursionError");
  }
}

export class SyntaxError extends CompileError {
  constructor(loc: Location, message?: string, name = "SyntaxError") {
    super(loc, message == undefined ? `invalid syntax` : message, name);
  }
}

export class IndentationError extends SyntaxError {
  constructor(loc: Location, message = `unexpected indent`) {
    super(loc, message, "IndentationError");
  }
}

export class TypeError extends CompileError {
  constructor(loc: Location, message?: string, name = "TypeError") {
    super(loc, message, name);
  }
}

export class TypeMismatchError extends TypeError {
  expect: Type[];
  got: Type[];
  constructor(
    loc: Location,
    expect: Type | Type[],
    got: Type | Type[],
    name = "TypeMismatchError"
  ) {
    if (Array.isArray(expect)) {
      super(
        loc,
        `Expected type '${expect
          .map((s) => typeToString(s))
          .join(", ")}';  got type '${(got as Type[])
          .map((s) => typeToString(s))
          .join(", ")}'`,
        name
      );
      this.expect = expect;
      this.got = got as Type[];
    } else {
      super(
        loc,
        `Expected type '${typeToString(expect)}'; got type '${typeToString(
          got as Type
        )}'`,
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
  constructor(
    loc: Location,
    op: BinOp | UniOp,
    operand: Type[],
    name = "TypeError"
  ) {
    if (operand.length == 1)
      super(
        loc,
        `unsupported operand type(s) for ${UniOp[op]}: '${typeToString(
          operand[0]
        )}'`,
        name
      );
    else
      super(
        loc,
        `unsupported operand type(s) for ${BinOp[op]}: '${typeToString(
          operand[0]
        )}' and '${typeToString(operand[1])}'`,
        name
      );
  }
}

export class ConditionTypeError extends TypeError {
  type: Type;
  constructor(loc: Location, got: Type) {
    super(
      loc,
      `Condition Expression Cannot be of type '${typeToString(got)}'`,
      "ConditionTypeError"
    );
    this.type = got;
  }
}

export class ValueError extends RuntimeError {
  constructor(message?: string, name = "ValueError") {
    super(message, name);
  }
}

export class UnicodeError extends ValueError {
  constructor(codec: string, character: string, pos: number) {
    super(
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
    default:
      return typ.tag;
  }
}
