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
*/

// I ❤️ TypeScript: https://github.com/microsoft/TypeScript/issues/13965
export class KeyboardInterrupt extends Error {
    __proto__: Error
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
    __proto__: Error
    constructor(message?: string, name = "Exception") {
        const trueProto = new.target.prototype;
        super(message);
        this.name = name;

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, Exception);
        }

        // Alternatively use Object.setPrototypeOf if you have an ES6 environment.
        this.__proto__ = trueProto;
    }
}

export class StopIteration extends Exception {
    constructor(message?: string, name = "StopIteration") {
        super(message, name);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

export class ArithmeticError extends Exception {
    constructor(message?: string, name = "ArithmeticError") {
        super(message, name);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

export class OverflowError extends ArithmeticError {
    constructor(message?: string, name = "OverflowError") {
        super(message, name);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

export class ZeroDivisionError extends ArithmeticError {
    constructor(message?: string, name = "ZeroDivisionError") {
        super(message, name);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

// If an object does not support attribute references or attribute assignment at all, TypeError is raised.
export class AttributeError extends Exception {
    constructor(message?: string, name = "AttributeError") {
        super(message, name);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

export class LookupError extends Exception {
    constructor(message?: string, name = "LookupError") {
        super(message, name);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

// If an index is not an integer, TypeError is raised.
export class IndexError extends LookupError {
    constructor(message?: string, name = "IndexError") {
        super(message, name);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

export class KeyError extends LookupError {
    constructor(message?: string, name = "KeyError") {
        super(message, name);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

export class MemoryError extends Exception {
    constructor(message?: string, name = "MemoryError") {
        super(message, name);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

export class NameError extends Exception {
    constructor(varName : string, message?: string, name = "NameError") {
        super(`name '${varName}' is not defined`, name);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

export class UnboundLocalError extends NameError {
    constructor(varName: string, message?: string, name = "UnboundLocalError") {
        super(`local variable '${varName}' referenced before assignment`, name);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

export class RuntimeError extends Exception {
    constructor(message?: string, name = "RuntimeError") {
        super(message);
        this.name = name;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

export class RecursionError extends RuntimeError {
    constructor(message?: string, name = "RecursionError") {
        super("maximum recursion depth exceeded");
        this.name = name;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

export class SyntaxError extends Exception {
    constructor(message?: string, name = "SyntaxError") {
        super(`invalid syntax`);
        this.name = name;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

export class IndentationError extends SyntaxError {
    constructor(message?: string, name = "IndentationError") {
        super(`unexpected indent`);
        this.name = name;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

export class TypeError extends Exception {
    constructor(message?: string, name = "TypeError") {
        super(message);
        this.name = name;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

export class ValueError extends Exception {
    constructor(message?: string, name = "ValueError") {
        super(message);
        this.name = name;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}

export class UnicodeError extends ValueError {
    constructor(codec: string, character: string, pos: number, message?: string, name = "UnicodeError") {
        super(`'${codec}' codec can't encode character '${character}' in position ${pos}`);
        this.name = name;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ZeroDivisionError);
        }
    }
}