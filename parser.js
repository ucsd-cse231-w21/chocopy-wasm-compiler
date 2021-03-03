"use strict";
exports.__esModule = true;
exports.parse = exports.traverse = exports.isClassDef = exports.isFunDef = exports.isVarInit = exports.traverseDefs = exports.traverseClass = exports.traverseFunDef = exports.traverseVarInit = exports.traverseParameters = exports.traverseType = exports.traverseStmt = exports.traverseArguments = exports.traverseExpr = exports.traverseLiteral = void 0;
var lezer_python_1 = require("lezer-python");
var ast_1 = require("./ast");
var utils_1 = require("./utils");
function traverseLiteral(c, s) {
    switch (c.type.name) {
        case "Number":
            return {
                tag: "num",
                value: BigInt(s.substring(c.from, c.to))
            };
        case "Boolean":
            return {
                tag: "bool",
                value: s.substring(c.from, c.to) === "True"
            };
        case "None":
            return {
                tag: "none"
            };
        default:
            throw new Error("Not literal");
    }
}
exports.traverseLiteral = traverseLiteral;
function traverseExpr(c, s) {
    console.info("Parser Expr", c.type.name);
    switch (c.type.name) {
        case "Number":
        case "Boolean":
        case "None":
            return {
                tag: "literal",
                value: traverseLiteral(c, s)
            };
        case "VariableName":
            return {
                tag: "id",
                name: s.substring(c.from, c.to)
            };
        case "CallExpression":
            c.firstChild();
            var callExpr = traverseExpr(c, s);
            c.nextSibling(); // go to arglist
            var args = traverseArguments(c, s);
            c.parent(); // pop CallExpression
            if (callExpr.tag === "lookup") {
                return {
                    tag: "method-call",
                    obj: callExpr.obj,
                    method: callExpr.field,
                    arguments: args
                };
            }
            else if (callExpr.tag === "id") {
                var callName = callExpr.name;
                var expr;
                if (callName === "print" || callName === "abs") {
                    expr = {
                        tag: "builtin1",
                        name: callName,
                        arg: args[0]
                    };
                }
                else if (callName === "max" || callName === "min" || callName === "pow") {
                    expr = {
                        tag: "builtin2",
                        name: callName,
                        left: args[0],
                        right: args[1]
                    };
                }
                else {
                    expr = { tag: "call", name: callName, arguments: args };
                }
                return expr;
            }
            else {
                throw new Error("Unknown target while parsing assignment");
            }
        case "BinaryExpression":
            c.firstChild(); // go to lhs 
            var lhsExpr = traverseExpr(c, s);
            c.nextSibling(); // go to op
            var opStr = s.substring(c.from, c.to);
            var op;
            switch (opStr) {
                case "+":
                    op = ast_1.BinOp.Plus;
                    break;
                case "-":
                    op = ast_1.BinOp.Minus;
                    break;
                case "*":
                    op = ast_1.BinOp.Mul;
                    break;
                case "//":
                    op = ast_1.BinOp.IDiv;
                    break;
                case "%":
                    op = ast_1.BinOp.Mod;
                    break;
                case "==":
                    op = ast_1.BinOp.Eq;
                    break;
                case "!=":
                    op = ast_1.BinOp.Neq;
                    break;
                case "<=":
                    op = ast_1.BinOp.Lte;
                    break;
                case ">=":
                    op = ast_1.BinOp.Gte;
                    break;
                case "<":
                    op = ast_1.BinOp.Lt;
                    break;
                case ">":
                    op = ast_1.BinOp.Gt;
                    break;
                case "is":
                    op = ast_1.BinOp.Is;
                    break;
                case "and":
                    op = ast_1.BinOp.And;
                    break;
                case "or":
                    op = ast_1.BinOp.Or;
                    break;
                default:
                    throw new Error("Could not parse op at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
            }
            c.nextSibling(); // go to rhs
            var rhsExpr = traverseExpr(c, s);
            c.parent();
            return {
                tag: "binop",
                op: op,
                left: lhsExpr,
                right: rhsExpr
            };
        case "ParenthesizedExpression":
            c.firstChild(); // Focus on (
            c.nextSibling(); // Focus on inside
            var expr = traverseExpr(c, s);
            c.parent();
            return expr;
        case "UnaryExpression":
            c.firstChild(); // Focus on op
            var opStr = s.substring(c.from, c.to);
            var op;
            switch (opStr) {
                case "-":
                    op = ast_1.UniOp.Neg;
                    break;
                case "not":
                    op = ast_1.UniOp.Not;
                    break;
                default:
                    throw new Error("Could not parse op at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
            }
            c.nextSibling(); // go to expr
            var expr = traverseExpr(c, s);
            c.parent();
            return {
                tag: "uniop",
                op: op,
                expr: expr
            };
        //
        case "MemberExpression":
            c.firstChild(); // Focus on object
            var objExpr = traverseExpr(c, s);
            c.nextSibling(); // Focus on .
            var memberChar = s.substring(c.from, c.to);
            //Check if "." or "["
            if (memberChar === ".") {
                c.nextSibling(); // Focus on property
                var propName = s.substring(c.from, c.to);
                c.parent();
                return {
                    tag: "lookup",
                    obj: objExpr,
                    field: propName
                };
            }
            else if (memberChar === "[") {
                c.nextSibling(); // Focus on property
                //Parse Expr used as index
                var propExpr = traverseExpr(c, s);
                c.parent();
                return {
                    tag: "bracket-lookup",
                    obj: objExpr,
                    key: propExpr
                };
            }
            else {
                throw new Error("Could not parse MemberExpression char");
            }
        case "self":
            return {
                tag: "id",
                name: "self"
            };
        case "ArrayExpression":
            var listExpr = [];
            c.firstChild();
            c.nextSibling();
            while (s.substring(c.from, c.to).trim() !== "]") {
                listExpr.push(traverseExpr(c, s));
                c.nextSibling(); // Focuses on either "," or ")"
                c.nextSibling(); // Focuses on a VariableName
            }
            c.parent();
            return {
                tag: "list-expr",
                contents: listExpr
            };
        default:
            throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
    }
}
exports.traverseExpr = traverseExpr;
function traverseArguments(c, s) {
    c.firstChild(); // Focuses on open paren
    var args = [];
    c.nextSibling();
    while (c.type.name !== ")") {
        var expr = traverseExpr(c, s);
        args.push(expr);
        c.nextSibling(); // Focuses on either "," or ")"
        c.nextSibling(); // Focuses on a VariableName
    }
    c.parent(); // Pop to ArgList
    return args;
}
exports.traverseArguments = traverseArguments;
// Traverse the lhs of assign operations and return the assignment targets
function traverseDestructure(c, s) {
    // TODO: Actually support destructured assignment
    var targets = [];
    var target = traverseExpr(c, s);
    var isSimple = true;
    if (!utils_1.isTagged(target, ast_1.ASSIGNABLE_TAGS)) {
        target.tag;
        throw new Error("Unknown target while parsing assignment");
    }
    targets.push({
        target: target,
        ignore: false,
        starred: false
    });
    c.nextSibling(); // move to =
    if (c.name !== "AssignOp") {
        isSimple = false;
        throw new Error("Multiple assignment currently not supported. Expected \"=\", got \"" + s.substring(c.from, c.to) + "\"");
    }
    c.prevSibling(); // Move back to previous for parsing to continue
    if (targets.length === 1 && isSimple) {
        return {
            isDestructured: false,
            targets: targets
        };
    }
    else if (targets.length === 0) {
        throw new Error("No assignment targets found");
    }
    else {
        throw new Error("Unsupported non-simple assignment");
    }
}
function traverseStmt(c, s) {
    console.info("Parser Stmt", c.type.name);
    switch (c.node.type.name) {
        case "ReturnStatement":
            c.firstChild(); // Focus return keyword
            var value;
            if (c.nextSibling()) // Focus expression
                value = traverseExpr(c, s);
            else
                value = { tag: "literal", value: { tag: "none" } };
            c.parent();
            return { tag: "return", value: value };
        case "AssignStatement":
            c.firstChild(); // go to name
            var destruct = traverseDestructure(c, s);
            c.nextSibling(); // go to equals
            c.nextSibling(); // go to value
            var value = traverseExpr(c, s);
            c.parent();
            var target = destruct.targets[0].target;
            // TODO: The new assign syntax should hook in here
            switch (target.tag) {
                case "lookup":
                    return {
                        tag: "field-assign",
                        obj: target.obj,
                        field: target.field,
                        value: value
                    };
                case "bracket-lookup":
                    return {
                        tag: "bracket-assign",
                        obj: target.obj,
                        key: target.key,
                        value: value
                    };
                case "id":
                    return {
                        tag: "assign",
                        name: target.name,
                        value: value
                    };
                default:
                    throw new Error("Unknown target while parsing assignment");
            }
        /*
        if (target.tag === "lookup") {
        } else if (target.tag === "id") {
        } else {
          throw new Error("Unknown target while parsing assignment");
        }
        */
        case "ExpressionStatement":
            c.firstChild();
            var expr = traverseExpr(c, s);
            c.parent(); // pop going into stmt
            return { tag: "expr", expr: expr };
        // case "FunctionDefinition":
        //   c.firstChild();  // Focus on def
        //   c.nextSibling(); // Focus on name of function
        //   var name = s.substring(c.from, c.to);
        //   c.nextSibling(); // Focus on ParamList
        //   var parameters = traverseParameters(c, s)
        //   c.nextSibling(); // Focus on Body or TypeDef
        //   let ret : Type = NONE;
        //   if(c.type.name === "TypeDef") {
        //     c.firstChild();
        //     ret = traverseType(c, s);
        //     c.parent();
        //   }
        //   c.firstChild();  // Focus on :
        //   var body = [];
        //   while(c.nextSibling()) {
        //     body.push(traverseStmt(c, s));
        //   }
        // console.log("Before pop to body: ", c.type.name);
        //   c.parent();      // Pop to Body
        // console.log("Before pop to def: ", c.type.name);
        //   c.parent();      // Pop to FunctionDefinition
        //   return {
        //     tag: "fun",
        //     name, parameters, body, ret
        //   }
        case "IfStatement":
            c.firstChild(); // Focus on if
            c.nextSibling(); // Focus on cond
            var cond = traverseExpr(c, s);
            // console.log("Cond:", cond);
            c.nextSibling(); // Focus on : thn
            c.firstChild(); // Focus on :
            var thn = [];
            while (c.nextSibling()) { // Focus on thn stmts
                thn.push(traverseStmt(c, s));
            }
            // console.log("Thn:", thn);
            c.parent();
            if (!c.nextSibling() || c.name !== "else") {
                // Focus on else
                throw new Error("if statement missing else block");
            }
            c.nextSibling(); // Focus on : els
            c.firstChild(); // Focus on :
            var els = [];
            while (c.nextSibling()) { // Focus on els stmts
                els.push(traverseStmt(c, s));
            }
            c.parent();
            c.parent();
            return {
                tag: "if",
                cond: cond,
                thn: thn,
                els: els
            };
        case "WhileStatement":
            c.firstChild(); // Focus on while
            c.nextSibling(); // Focus on condition
            var cond = traverseExpr(c, s);
            c.nextSibling(); // Focus on body
            var body = [];
            c.firstChild(); // Focus on :
            while (c.nextSibling()) {
                body.push(traverseStmt(c, s));
            }
            c.parent();
            c.parent();
            return {
                tag: "while",
                cond: cond,
                body: body
            };
        case "PassStatement":
            return { tag: "pass" };
        default:
            throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
    }
}
exports.traverseStmt = traverseStmt;
function traverseType(c, s) {
    // For now, always a VariableName
    var name = s.substring(c.from, c.to);
    switch (name) {
        case "int": return utils_1.NUM;
        case "bool": return utils_1.BOOL;
        default: return utils_1.CLASS(name);
    }
}
exports.traverseType = traverseType;
function traverseParameters(c, s) {
    c.firstChild(); // Focuses on open paren
    var parameters = [];
    c.nextSibling(); // Focuses on a VariableName
    while (c.type.name !== ")") {
        var name_1 = s.substring(c.from, c.to);
        c.nextSibling(); // Focuses on "TypeDef", hopefully, or "," if mistake
        var nextTagName = c.type.name; // NOTE(joe): a bit of a hack so the next line doesn't if-split
        if (nextTagName !== "TypeDef") {
            throw new Error("Missed type annotation for parameter " + name_1);
        }
        ;
        c.firstChild(); // Enter TypeDef
        c.nextSibling(); // Focuses on type itself
        var typ = traverseType(c, s);
        c.parent();
        c.nextSibling(); // Move on to comma or ")" or "="
        nextTagName = c.type.name; // NOTE(daniel): copying joe's hack for now
        if (nextTagName === "AssignOp") {
            c.nextSibling();
            var val = traverseLiteral(c, s);
            parameters.push({ name: name_1, type: typ, value: val });
        }
        else {
            parameters.push({ name: name_1, type: typ });
        }
        c.nextSibling(); // Focuses on a VariableName
    }
    c.parent(); // Pop to ParamList
    return parameters;
}
exports.traverseParameters = traverseParameters;
function traverseVarInit(c, s) {
    c.firstChild(); // go to name
    var name = s.substring(c.from, c.to);
    c.nextSibling(); // go to : type
    if (c.type.name !== "TypeDef") {
        c.parent();
        throw Error("invalid variable init");
    }
    c.firstChild(); // go to :
    c.nextSibling(); // go to type
    var type = traverseType(c, s);
    c.parent();
    c.nextSibling(); // go to =
    c.nextSibling(); // go to value
    var value = traverseLiteral(c, s);
    c.parent();
    return { name: name, type: type, value: value };
}
exports.traverseVarInit = traverseVarInit;
function traverseFunDef(c, s) {
    c.firstChild(); // Focus on def
    c.nextSibling(); // Focus on name of function
    var name = s.substring(c.from, c.to);
    c.nextSibling(); // Focus on ParamList
    var parameters = traverseParameters(c, s);
    c.nextSibling(); // Focus on Body or TypeDef
    var ret = utils_1.NONE;
    if (c.type.name === "TypeDef") {
        c.firstChild();
        ret = traverseType(c, s);
        c.parent();
        c.nextSibling();
    }
    c.firstChild(); // Focus on :
    var inits = [];
    var body = [];
    var hasChild = c.nextSibling();
    while (hasChild) {
        if (isVarInit(c, s)) {
            inits.push(traverseVarInit(c, s));
        }
        else {
            break;
        }
        hasChild = c.nextSibling();
    }
    while (hasChild) {
        body.push(traverseStmt(c, s));
        hasChild = c.nextSibling();
    }
    // console.log("Before pop to body: ", c.type.name);
    c.parent(); // Pop to Body
    // console.log("Before pop to def: ", c.type.name);
    c.parent(); // Pop to FunctionDefinition
    // TODO: Closure group: fill decls and funs to make things work
    var decls = [];
    var funs = [];
    return { name: name, parameters: parameters, ret: ret, inits: inits, decls: decls, funs: funs, body: body };
}
exports.traverseFunDef = traverseFunDef;
function traverseClass(c, s) {
    var fields = [];
    var methods = [];
    c.firstChild();
    c.nextSibling(); // Focus on class name
    var className = s.substring(c.from, c.to);
    c.nextSibling(); // Focus on arglist/superclass
    c.nextSibling(); // Focus on body
    c.firstChild(); // Focus colon
    while (c.nextSibling()) { // Focuses first field
        if (isVarInit(c, s)) {
            fields.push(traverseVarInit(c, s));
        }
        else if (isFunDef(c, s)) {
            methods.push(traverseFunDef(c, s));
        }
        else {
            throw new Error("Could not parse the body of class: " + className);
        }
    }
    c.parent();
    c.parent();
    if (!methods.find(function (method) { return method.name === "__init__"; })) {
        methods.push({
            name: "__init__",
            parameters: [{ name: "self", type: utils_1.CLASS(className) }],
            ret: utils_1.NONE,
            decls: [],
            inits: [],
            funs: [],
            body: []
        });
    }
    return {
        name: className,
        fields: fields,
        methods: methods
    };
}
exports.traverseClass = traverseClass;
function traverseDefs(c, s) {
    var inits = [];
    var funs = [];
    var classes = [];
    while (true) {
        if (isVarInit(c, s)) {
            inits.push(traverseVarInit(c, s));
        }
        else if (isFunDef(c, s)) {
            funs.push(traverseFunDef(c, s));
        }
        else if (isClassDef(c, s)) {
            classes.push(traverseClass(c, s));
        }
        else {
            return [inits, funs, classes];
        }
        c.nextSibling();
    }
}
exports.traverseDefs = traverseDefs;
function isVarInit(c, s) {
    if (c.type.name === "AssignStatement") {
        c.firstChild(); // Focus on lhs
        c.nextSibling(); // go to : type
        var isVar = c.type.name === "TypeDef";
        c.parent();
        return isVar;
    }
    else {
        return false;
    }
}
exports.isVarInit = isVarInit;
function isFunDef(c, s) {
    return c.type.name === "FunctionDefinition";
}
exports.isFunDef = isFunDef;
function isClassDef(c, s) {
    return c.type.name === "ClassDefinition";
}
exports.isClassDef = isClassDef;
function traverse(c, s) {
    switch (c.node.type.name) {
        case "Script":
            var inits = [];
            var funs = [];
            var classes = [];
            var stmts = [];
            var hasChild = c.firstChild();
            while (hasChild) {
                if (isVarInit(c, s)) {
                    inits.push(traverseVarInit(c, s));
                }
                else if (isFunDef(c, s)) {
                    funs.push(traverseFunDef(c, s));
                }
                else if (isClassDef(c, s)) {
                    classes.push(traverseClass(c, s));
                }
                else {
                    break;
                }
                hasChild = c.nextSibling();
            }
            while (hasChild) {
                stmts.push(traverseStmt(c, s));
                hasChild = c.nextSibling();
            }
            c.parent();
            return { funs: funs, inits: inits, classes: classes, stmts: stmts };
        default:
            throw new Error("Could not parse program at " + c.node.from + " " + c.node.to);
    }
}
exports.traverse = traverse;
function parse(source) {
    var t = lezer_python_1.parser.parse(source);
    return traverse(t.cursor(), source);
}
exports.parse = parse;
