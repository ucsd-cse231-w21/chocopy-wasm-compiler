/*
referrence: https://docs.python.org/3/library/exceptions.html
Use instanceof to get additional properties of each Error type, if necessary.

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

    +-- UnsupportedOprandTypeError -> This error class is for TypeError related to operator like + - // * ....
		+-- TypeMismatchError -> This error class is for TypeError that is allowed in Python but not in our project
		+-- ConditionTypeError -> This error class is for condition type check in while and if, which does not exist in real python.
*/

import { BinOp, Location } from "./ast"

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
	constructor(message?: string, loc?: Location) {
		super(message, "StopIteration", loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, StopIteration);
		}
	}
}


export class ArithmeticError extends Exception {
	constructor(message?: string, loc?: Location) {
		super(message, "ArithmeticError", loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ArithmeticError);
		}
	}
}


// e.g. math.exp(1000)
export class OverflowError extends ArithmeticError {
	constructor(message?: string, loc?: Location) {
		super(message, loc);
		this.name = "OverflowError";
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, OverflowError);
		}
	}
}


// e.g. 7/0
export class ZeroDivisionError extends ArithmeticError {
	constructor(message = "division by zero", loc?: Location) {
		super(message, loc);
		this.name = "ZeroDivisionError";
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ZeroDivisionError);
		}
	}
}


// If an object does not support attribute references or attribute assignment at all, TypeError is raised.
export class AttributeError extends Exception {
	constructor(obj: string, attr: string, loc?: Location) {
		var message = `'${obj}' object has no attribute '${attr}'`;
		super(message, "AttributeError", loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, AttributeError);
		}
	}
}


export class LookupError extends Exception {
	constructor(message?: string, loc?: Location) {
		super(message, "LookupError", loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, LookupError);
		}
	}
}


// If an index is not an integer, TypeError is raised.
export class IndexError extends LookupError {
	constructor(message = "list index out of range", loc?: Location) {
		super(message, loc);
		this.name = "IndexError";
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, IndexError);
		}
	}
}


export class KeyError extends LookupError {
	constructor(keyName: string, loc?: Location) {
		super(`'${keyName}'`, loc);
		this.name = "KeyError";
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, KeyError);
		}
	}
}


export class MemoryError extends Exception {
	constructor(message?: string, loc?: Location) {
		super(message, "MemoryError", loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, MemoryError);
		}
	}
}


export class NameError extends Exception {
	constructor(varName: string, loc?: Location) {
		super(`name '${varName}' is not defined`, "NameError", loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, NameError);
		}
	}
}

export class UnboundLocalError extends NameError {
	constructor(varName: string, loc?: Location) {
		super(`local variable '${varName}' referenced before assignment`, loc);
		this.name = "UnboundLocalError";
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, UnboundLocalError);
		}
	}
}

export class RuntimeError extends Exception {
	constructor(message?: string, loc?: Location) {
		super(message, "RuntimeError", loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, RuntimeError);
		}
	}
}

export class RecursionError extends RuntimeError {
	constructor(loc?: Location) {
		super("maximum recursion depth exceeded", loc);
		this.name = "RecursionError";
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, RecursionError);
		}
	}
}

export class SyntaxError extends Exception {
	constructor(message?: string, loc?: Location) {
		super(message == undefined ? `invalid syntax` : message, "SyntaxError", loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, SyntaxError);
		}
	}
}

export class IndentationError extends SyntaxError {
	constructor(message?: string, loc?: Location) {
		super(message == undefined ? `unexpected indent` : message, loc);
		this.name = "IndentationError";
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, IndentationError);
		}
	}
}

export class TypeError extends Exception {
	constructor(message?: string, loc?: Location) {
		super(message, "TypeError", loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, TypeError);
		}
	}
}

export class TypeMismatchError extends Exception {
	constructor(expect: string, got: string, loc?: Location) {
		super(`Expected type '${expect}'; got type '${got}'`, "TypeMismatchError", loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, TypeMismatchError);
		}
	} 
}

export class UnsupportedOprandTypeError extends Exception {
	constructor(op: string, oprand: string[], loc?: Location) {
		if (oprand.length == 1) 
			super(`unsupported operand type(s) for ${op}: '${oprand[0]}'`, "TypeError", loc); 
		else 
			super(`unsupported operand type(s) for ${op}: '${oprand[0]}' and '${oprand[1]}'`, "TypeError", loc); 
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, TypeMismatchError);
		}
	} 
}

export class ConditionTypeError extends Exception {
	constructor(got: string, loc?: Location) {
		super(`Condition Expression Cannot be of type '${got}'`, "ConditionTypeError", loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ConditionTypeError);
		}
	} 
}

export class ValueError extends Exception {
	constructor(message?: string, loc?: Location) {
		super(message, "ValueError", loc);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ValueError);
		}
	}
}

export class UnicodeError extends ValueError {
	constructor(codec: string, character: string, pos: number, loc?: Location) {
		super(`'${codec}' codec can't encode character '${character}' in position ${pos}`, loc);
		this.name = "UnicodeError";
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, UnicodeError);
		}
	}
}