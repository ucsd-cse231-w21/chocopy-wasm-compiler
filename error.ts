/*
referrence: https://docs.python.org/3/library/exceptions.html
Use instanceof to get additional properties of each Error type, if necessary.

+-- Exception

+-- RuntimeError (DynamicError)
		+-- KeyboardInterrupt
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
    +-- UnsupportedOprandTypeError -> This error class is for TypeError related to operator like + - // * ....
		+-- TypeMismatchError -> This error class is for TypeError that is allowed in Python but not in our project
		+-- ConditionTypeError -> This error class is for condition type check in while and if, which does not exist in real python.
*/

import { type } from "cypress/types/jquery";
import { stringInput } from "lezer-tree";
import { BinOp, UniOp, Location, Type } from "./ast";

// I ❤️ TypeScript: https://github.com/microsoft/TypeScript/issues/13965
export class KeyboardInterrupt extends Error {
  __proto__: Error;
  constructor(message?: string) {
    const trueProto = new.target.prototype;
    super(message);
    this.name = "KeyboardInterrupt";

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, KeyboardInterrupt);
    }

    // Alternatively use Object.setPrototypeOf if you have an ES6 environment.
    this.__proto__ = trueProto;
  }
}

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

  constructor(message?: string, name = "RuntimeError") {
    const trueProto = new.target.prototype;
    super(message);
    this.name = name;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RuntimeError);
    }
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
  constructor(message?: string, name = "OverflowError") {
    super(message, name);
  }
}

// e.g. 7/0
export class ZeroDivisionError extends ArithmeticError {
  constructor(message = "division by zero", name = "ZeroDivisionError") {
    super(message, name);
  }
}

// If an object does not support attribute references or attribute assignment at all, TypeError is raised.
export class AttributeError extends CompileError {
  obj: Type;
  attr: string;
  constructor(loc: Location, obj: Type, attr: string) {
    var message = `'${obj.tag}' object has no attribute '${attr}'`;
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
  constructor(keyName: string, name = "KeyError") {
    super(`'${keyName}'`, name);
  }
}

export class MemoryError extends RuntimeError {
  constructor(message?: string, name = "MemoryError") {
    super(message, name);
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
  constructor(loc: Location, varName: string, name = "UnboundLocalError") {
    super(loc, `local variable '${varName}' referenced before assignment`, name);
    this.varName = varName;
  }
}

export class RecursionError extends RuntimeError {
  constructor(name = "RecursionError") {
    super("maximum recursion depth exceeded", name);
  }
}

export class SyntaxError extends CompileError {
  constructor(loc: Location, message?: string, name = "SyntaxError") {
    super(loc, message == undefined ? `invalid syntax` : message, name);
  }
}

export class IndentationError extends SyntaxError {
  constructor(loc: Location, message = `unexpected indent`, name = "IndentationError") {
    super(loc, message, name);
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
        `Expected type '${expect.map((s) => s.tag).join(", ")}';  got type '${(got as Type[])
          .map((s) => s.tag)
          .join(", ")}'`,
        name
      );
      this.expect = expect;
      this.got = got as Type[];
    } else {
      super(loc, `Expected type '${expect.tag}'; got type '${(got as Type).tag}'`);
      this.expect = [expect];
      this.got = [got as Type];
    }
  }
}

export class UnsupportedOprandTypeError extends TypeError {
  op: BinOp | UniOp;
  oprand: Type[];
  constructor(loc: Location, op: BinOp | UniOp, oprand: Type[], name = "TypeError") {
    if (oprand.length == 1)
      super(loc, `unsupported operand type(s) for ${op}: '${oprand[0].tag}'`, name);
    else
      super(
        loc,
        `unsupported operand type(s) for ${op}: '${oprand[0].tag}' and '${oprand[1].tag}'`,
        name
      );
  }
}

export class ConditionTypeError extends CompileError {
  type: Type;
  constructor(loc: Location, got: Type, name = "ConditionTypeError") {
    super(loc, `Condition Expression Cannot be of type '${got.tag}'`, name);
    this.type = got;
  }
}

export class ValueError extends RuntimeError {
  constructor(message?: string, name = "ValueError") {
    super(message, name);
  }
}

export class UnicodeError extends RuntimeError {
  constructor(codec: string, character: string, pos: number, name = "UnicodeError") {
    super(`'${codec}' codec can't encode character '${character}' in position ${pos}`, name);
  }
}
