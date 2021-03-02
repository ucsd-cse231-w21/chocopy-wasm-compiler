/*
referrence: https://docs.python.org/3/library/exceptions.html
Use instanceof to get additional properties of each Error type.

+-- KeyboardInterrupt
+-- Exception
    +-- StopInteration
    +-- ArithmeticError
    |   +-- OverflowError
    |   +-- ZeroDivisionError
    +-- AttributeError
    +-- LookupError
    |   +-- IndexError
    |   +-- KeyError
    +-- MemoryError
    +-- NameError
    |   +-- UnBoundLocalError
    +-- RuntimeError
    |   +-- RecursionError
    +-- SyntaxError
    |   +-- IndentationError
    +-- TypeError
    +-- ValueError
    |   +-- UnicodeError
    +-- TypeMismatchError -> This error class is for TypeError that is allowed in Python but not in our project
*/

import { Location } from "./ast"

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

export class Exception extends Error {
	__proto__: Error;
	loc: Location

	constructor(message?: string, name = "Exception", loc?: Location) {
		const trueProto = new.target.prototype;
		super(message);
		this.name = name;
		this.loc = loc;

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace) {
				Error.captureStackTrace(this, Exception);
		}
		// Alternatively use Object.setPrototypeOf if you have an ES6 environment.
		this.__proto__ = trueProto;
	}
}

export class StopIteration extends Exception {
	constructor(message?: string, name = "StopIteration", loc?: Location) {
		super(message, name, loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, StopIteration);
		}
	}
}


export class ArithmeticError extends Exception {
	constructor(message?: string, name = "ArithmeticError", loc?: Location) {
		super(message, name, loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ArithmeticError);
		}
	}
}


// e.g. math.exp(1000)
export class OverflowError extends ArithmeticError {
	constructor(message?: string, name = "OverflowError", loc?: Location) {
		super(message, name, loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, OverflowError);
		}
	}
}


// e.g. 7/0
export class ZeroDivisionError extends ArithmeticError {
	constructor({ message = "division by zero", name = "ZeroDivisionError", loc }: { message?: string, name: string, loc?: Location }) {
		super(message, name, loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ZeroDivisionError);
		}
	}
}


// If an object does not support attribute references or attribute assignment at all, TypeError is raised.
export class AttributeError extends Exception {
	constructor(obj: string, attr: string, name = "AttributeError", loc?: Location) {
		var message = `'${obj}' object has no attribute '${attr}'`;
		super(message, name, loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, AttributeError);
		}
	}
}


export class LookupError extends Exception {
	constructor(message?: string, name = "LookupError", loc?: Location) {
		super(message, name, loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, LookupError);
		}
	}
}


// If an index is not an integer, TypeError is raised.
export class IndexError extends LookupError {
	constructor({ message = "list index out of range", name = "IndexError", loc }: { message?: string, name: string, loc?: Location }) {
		super(message, name, loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, IndexError);
		}
	}
}


export class KeyError extends LookupError {
	constructor(keyName: string, name = "KeyError", loc?: Location) {
		super(`'${keyName}'`, name, loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, KeyError);
		}
	}
}


export class MemoryError extends Exception {
	constructor(message?: string, name = "MemoryError", loc?: Location) {
		super(message, name, loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, MemoryError);
		}
	}
}


export class NameError extends Exception {
	constructor(varName: string, name = "NameError") {
		super(`name '${varName}' is not defined`, name);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, NameError);
		}
	}
}

export class UnboundLocalError extends NameError {
	constructor(varName: string, name = "UnboundLocalError") {
		super(`local variable '${varName}' referenced before assignment`, name);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, UnboundLocalError);
		}
	}
}

export class RuntimeError extends Exception {
	constructor(message?: string, name = "RuntimeError") {
		super(message);
		this.name = name;
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, RuntimeError);
		}
	}
}

export class RecursionError extends RuntimeError {
	constructor(message?: string, name = "RecursionError") {
		super("maximum recursion depth exceeded");
		this.name = name;
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, RecursionError);
		}
	}
}

export class SyntaxError extends Exception {
	constructor(message?: string, name = "SyntaxError") {
		super(`invalid syntax`);
		this.name = name;
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, SyntaxError);
		}
	}
}

export class IndentationError extends SyntaxError {
	constructor(message?: string, name = "IndentationError") {
		super(`unexpected indent`);
		this.name = name;
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, IndentationError);
		}
	}
}

export class TypeError extends Exception {
	constructor(message?: string, name = "TypeError") {
		super(message);
		this.name = name;
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, TypeError);
		}
	}
}

export class TypeMismatchError extends Exception {
	constructor(expect: string, got: string, message?: string, name = "TypeError") {
		super(`Expected type '${expect}'; got type '${got}'`);
		this.name = name;
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, TypeMismatchError);
		}
	} 
}

export class ValueError extends Exception {
	constructor(message?: string, name = "ValueError") {
		super(message);
		this.name = name;
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ValueError);
		}
	}
}

export class UnicodeError extends ValueError {
	constructor(codec: string, character: string, pos: number, message?: string, name = "UnicodeError") {
		super(`'${codec}' codec can't encode character '${character}' in position ${pos}`);
		this.name = name;
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, UnicodeError);
		}
	}
}
