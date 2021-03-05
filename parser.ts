import { parser } from "lezer-python";
import { TreeCursor } from "lezer-tree";
import {
  Program,
  Expr,
  Stmt,
  UniOp,
  BinOp,
  Parameter,
  Type,
  FunDef,
  VarInit,
  Class,
  Literal,
  Scope,
  AssignTarget,
  Destructure,
  ASSIGNABLE_TAGS,
  Location,
} from "./ast";

import { NUM, BOOL, NONE, CLASS, isTagged } from "./utils";
import * as BaseException from "./error";

export function getSourcePos(c: TreeCursor, s: string): Location {
  const substring = s.substring(0, c.node.from);
  const line = substring.split("\n").length;
  const prevContent = substring
    .split("\n")
    .slice(0, line - 1)
    .join("\n");
  const col = c.node.from - prevContent.length;
  return {
    line: line,
    col: col,
    length: c.node.to - c.node.from,
  };
}

export function traverseLiteral(c: TreeCursor, s: string): Literal {
  var location: Location = getSourcePos(c, s);
  switch (c.type.name) {
    case "Number":
      return {
        tag: "num",
        value: BigInt(s.substring(c.from, c.to)),
      };
    case "Boolean":
      return {
        tag: "bool",
        value: s.substring(c.from, c.to) === "True",
      };
    case "None":
      return {
        tag: "none",
      };
    default:
      throw new BaseException.CompileError(location, "not literal", "ParsingError");
  }
}

export function traverseExpr(c: TreeCursor, s: string): Expr<Location> {
  var location: Location = getSourcePos(c, s);
  switch (c.type.name) {
    case "Number":
    case "Boolean":
    case "None":
      return {
        a: location,
        tag: "literal",
        value: traverseLiteral(c, s),
      };
    case "VariableName":
      return {
        a: location,
        tag: "id",
        name: s.substring(c.from, c.to),
      };
    case "CallExpression":
      c.firstChild();
      const callExpr = traverseExpr(c, s);
      c.nextSibling(); // go to arglist
      let args = traverseArguments(c, s);
      c.parent(); // pop CallExpression

      if (callExpr.tag === "lookup") {
        return {
          a: location,
          tag: "method-call",
          obj: callExpr.obj,
          method: callExpr.field,
          arguments: args,
        };
      } else if (callExpr.tag === "id") {
        const callName = callExpr.name;
        var expr: Expr<Location>;
        if (callName === "print" || callName === "abs") {
          expr = {
            a: location,
            tag: "builtin1",
            name: callName,
            arg: args[0],
          };
        } else if (callName === "max" || callName === "min" || callName === "pow") {
          expr = {
            a: location,
            tag: "builtin2",
            name: callName,
            left: args[0],
            right: args[1],
          };
        } else {
          expr = { a: location, tag: "call", name: callName, arguments: args };
        }
        return expr;
      } else {
        throw new BaseException.CompileError(
          location,
          "Unknown target while parsing assignment",
          "ParsingError"
        );
      }

    case "BinaryExpression":
      c.firstChild(); // go to lhs
      const lhsExpr = traverseExpr(c, s);
      c.nextSibling(); // go to op
      var opStr = s.substring(c.from, c.to);
      var op;
      switch (opStr) {
        case "+":
          op = BinOp.Plus;
          break;
        case "-":
          op = BinOp.Minus;
          break;
        case "*":
          op = BinOp.Mul;
          break;
        case "//":
          op = BinOp.IDiv;
          break;
        case "%":
          op = BinOp.Mod;
          break;
        case "==":
          op = BinOp.Eq;
          break;
        case "!=":
          op = BinOp.Neq;
          break;
        case "<=":
          op = BinOp.Lte;
          break;
        case ">=":
          op = BinOp.Gte;
          break;
        case "<":
          op = BinOp.Lt;
          break;
        case ">":
          op = BinOp.Gt;
          break;
        case "is":
          op = BinOp.Is;
          break;
        case "and":
          op = BinOp.And;
          break;
        case "or":
          op = BinOp.Or;
          break;
        default:
          throw new BaseException.CompileError(
            location,
            "Could not parse op at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to),
            "ParsingError"
          );
      }
      c.nextSibling(); // go to rhs
      const rhsExpr = traverseExpr(c, s);
      c.parent();
      return {
        a: location,
        tag: "binop",
        op: op,
        left: lhsExpr,
        right: rhsExpr,
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
          op = UniOp.Neg;
          break;
        case "not":
          op = UniOp.Not;
          break;
        default:
          throw new BaseException.CompileError(
            location,
            "Could not parse op at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to),
            "ParsingError"
          );
      }
      c.nextSibling(); // go to expr
      var expr = traverseExpr(c, s);
      c.parent();
      return {
        a: location,
        tag: "uniop",
        op: op,
        expr: expr,
      };
    case "MemberExpression":
      c.firstChild(); // Focus on object
      var objExpr = traverseExpr(c, s);
      c.nextSibling(); // Focus on .
      c.nextSibling(); // Focus on property
      var propName = s.substring(c.from, c.to);
      c.parent();
      return {
        a: location,
        tag: "lookup",
        obj: objExpr,
        field: propName,
      };
    case "self":
      return {
        a: location,
        tag: "id",
        name: "self",
      };
    default:
      throw new BaseException.CompileError(
        location,
        "Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to),
        "ParsingError"
      );
  }
}

export function traverseArguments(c: TreeCursor, s: string): Array<Expr<Location>> {
  c.firstChild(); // Focuses on open paren
  const args = [];
  c.nextSibling();
  while (c.type.name !== ")") {
    let expr = traverseExpr(c, s);
    args.push(expr);
    c.nextSibling(); // Focuses on either "," or ")"
    c.nextSibling(); // Focuses on a VariableName
  }
  c.parent(); // Pop to ArgList
  return args;
}

// Traverse the lhs of assign operations and return the assignment targets
function traverseDestructure(c: TreeCursor, s: string): Destructure<Location> {
  // TODO: Actually support destructured assignment
  const targets: AssignTarget<Location>[] = [];
  const target = traverseExpr(c, s);
  var location: Location = getSourcePos(c, s);
  let isSimple = true;
  if (!isTagged(target, ASSIGNABLE_TAGS)) {
    target.tag;
    throw new BaseException.CompileError(
      location,
      "Unknown target while parsing assignment",
      "ParsingError"
    );
  }
  targets.push({
    target,
    ignore: false,
    starred: false,
  });
  c.nextSibling(); // move to =
  if (c.name !== "AssignOp") {
    isSimple = false;
    throw new BaseException.CompileError(
      location,
      `Multiple assignment currently not supported. Expected "=", got "${s.substring(
        c.from,
        c.to
      )}"`,
      "ParsingError"
    );
  }
  c.prevSibling(); // Move back to previous for parsing to continue

  if (targets.length === 1 && isSimple) {
    return {
      isDestructured: false,
      targets,
    };
  } else if (targets.length === 0) {
    throw new BaseException.CompileError(location, "No assignment targets found", "ParsingError");
  } else {
    throw new BaseException.CompileError(
      location,
      "Unsupported non-simple assignment",
      "ParsingError"
    );
  }
}

export function traverseStmt(c: TreeCursor, s: string): Stmt<Location> {
  var location: Location = getSourcePos(c, s);
  switch (c.node.type.name) {
    case "ReturnStatement":
      c.firstChild(); // Focus return keyword

      var value: Expr<Location>;
      if (c.nextSibling())
        // Focus expression
        value = traverseExpr(c, s);
      else value = { a: location, tag: "literal", value: { tag: "none" } };
      c.parent();
      return { tag: "return", value, a: location };
    case "AssignStatement":
      c.firstChild(); // go to name
      const destruct = traverseDestructure(c, s);
      c.nextSibling(); // go to equals
      c.nextSibling(); // go to value
      var value = traverseExpr(c, s);
      c.parent();

      const target = destruct.targets[0].target;

      // TODO: The new assign syntax should hook in here
      if (target.tag === "lookup") {
        return {
          tag: "field-assign",
          obj: target.obj,
          field: target.field,
          value: value,
          a: location,
        };
      } else if (target.tag === "id") {
        return {
          tag: "assign",
          name: target.name,
          value: value,
          a: location,
        };
      } else {
        throw new BaseException.CompileError(
          location,
          "Unknown target while parsing assignment",
          "ParsingError"
        );
      }
    case "ExpressionStatement":
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return { tag: "expr", expr: expr, a: location };
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
      while (c.nextSibling()) {
        // Focus on thn stmts
        thn.push(traverseStmt(c, s));
      }
      // console.log("Thn:", thn);
      c.parent();

      if (!c.nextSibling() || c.name !== "else") {
        // Focus on else
        throw new BaseException.CompileError(
          location,
          "if statement missing else block",
          "ParsingError"
        );
      }
      c.nextSibling(); // Focus on : els
      c.firstChild(); // Focus on :
      var els = [];
      while (c.nextSibling()) {
        // Focus on els stmts
        els.push(traverseStmt(c, s));
      }
      c.parent();
      c.parent();
      return {
        tag: "if",
        cond: cond,
        thn: thn,
        els: els,
        a: location,
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
        cond,
        body,
        a: location,
      };
    case "PassStatement":
      return { tag: "pass", a: location };
    default:
      throw new BaseException.CompileError(
        location,
        "Could not parse stmt at " +
          c.node.from +
          " " +
          c.node.to +
          ": " +
          s.substring(c.from, c.to),
        "ParsingError"
      );
  }
}

export function traverseType(c: TreeCursor, s: string): Type {
  // For now, always a VariableName
  let name = s.substring(c.from, c.to);
  switch (name) {
    case "int":
      return NUM;
    case "bool":
      return BOOL;
    default:
      return CLASS(name);
  }
}

export function traverseParameters(c: TreeCursor, s: string): Array<Parameter<Location>> {
  var location: Location;
  c.firstChild(); // Focuses on open paren
  const parameters = [];
  c.nextSibling(); // Focuses on a VariableName
  while (c.type.name !== ")") {
    let name = s.substring(c.from, c.to);
    c.nextSibling(); // Focuses on "TypeDef", hopefully, or "," if mistake
    let nextTagName = c.type.name; // NOTE(joe): a bit of a hack so the next line doesn't if-split
    if (nextTagName !== "TypeDef") {
      throw new BaseException.CompileError(
        location,
        "Missed type annotation for parameter " + name,
        "ParsingError"
      );
    }
    c.firstChild(); // Enter TypeDef
    c.nextSibling(); // Focuses on type itself
    let typ = traverseType(c, s);
    c.parent();
    c.nextSibling(); // Move on to comma or ")" or "="
    nextTagName = c.type.name; // NOTE(daniel): copying joe's hack for now
    if (nextTagName === "AssignOp") {
      c.nextSibling();
      let val = traverseLiteral(c, s);
      parameters.push({ name, type: typ, value: val, a: location });
    } else {
      parameters.push({ name, type: typ, a: location });
    }
    c.nextSibling(); // Focuses on a VariableName
  }
  c.parent(); // Pop to ParamList
  return parameters;
}

export function traverseVarInit(c: TreeCursor, s: string): VarInit<Location> {
  var location: Location = getSourcePos(c, s);
  c.firstChild(); // go to name
  var name = s.substring(c.from, c.to);
  c.nextSibling(); // go to : type

  if (c.type.name !== "TypeDef") {
    c.parent();
    throw new BaseException.CompileError(location, "invalid variable init", "ParsingError");
  }
  c.firstChild(); // go to :
  c.nextSibling(); // go to type
  const type = traverseType(c, s);
  c.parent();

  c.nextSibling(); // go to =
  c.nextSibling(); // go to value
  var value = traverseLiteral(c, s);
  c.parent();
  return { name, type, value, a: location };
}

export function traverseFunDef(c: TreeCursor, s: string): FunDef<Location> {
  var location: Location = getSourcePos(c, s);
  c.firstChild(); // Focus on def
  c.nextSibling(); // Focus on name of function
  var name = s.substring(c.from, c.to);
  c.nextSibling(); // Focus on ParamList
  var parameters = traverseParameters(c, s);
  c.nextSibling(); // Focus on Body or TypeDef
  let ret: Type = NONE;
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
    } else {
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
  const decls: Scope<null>[] = [];
  const funs: FunDef<null>[] = [];

  return { a: location, name, parameters, ret, inits, decls, funs, body };
}

export function traverseClass(c: TreeCursor, s: string): Class<Location> {
  var location: Location = getSourcePos(c, s);
  const fields: Array<VarInit<Location>> = [];
  const methods: Array<FunDef<Location>> = [];
  c.firstChild();
  c.nextSibling(); // Focus on class name
  const className = s.substring(c.from, c.to);
  c.nextSibling(); // Focus on arglist/superclass
  c.nextSibling(); // Focus on body
  c.firstChild(); // Focus colon
  while (c.nextSibling()) {
    // Focuses first field
    if (isVarInit(c, s)) {
      fields.push(traverseVarInit(c, s));
    } else if (isFunDef(c, s)) {
      methods.push(traverseFunDef(c, s));
    } else {
      throw new BaseException.CompileError(
        location,
        `Could not parse the body of class: ${className}`,
        "ParsingError"
      );
    }
  }
  c.parent();
  c.parent();

  if (!methods.find((method) => method.name === "__init__")) {
    methods.push({
      name: "__init__",
      parameters: [{ name: "self", type: CLASS(className) }],
      ret: NONE,
      decls: [],
      inits: [],
      funs: [],
      body: [],
    });
  }
  return {
    a: location,
    name: className,
    fields,
    methods,
  };
}

export function traverseDefs(
  c: TreeCursor,
  s: string
): [Array<VarInit<Location>>, Array<FunDef<Location>>, Array<Class<Location>>] {
  const inits: Array<VarInit<Location>> = [];
  const funs: Array<FunDef<Location>> = [];
  const classes: Array<Class<Location>> = [];

  while (true) {
    if (isVarInit(c, s)) {
      inits.push(traverseVarInit(c, s));
    } else if (isFunDef(c, s)) {
      funs.push(traverseFunDef(c, s));
    } else if (isClassDef(c, s)) {
      classes.push(traverseClass(c, s));
    } else {
      return [inits, funs, classes];
    }
    c.nextSibling();
  }
}

export function isVarInit(c: TreeCursor, s: string): boolean {
  if (c.type.name === "AssignStatement") {
    c.firstChild(); // Focus on lhs
    c.nextSibling(); // go to : type

    const isVar = (c.type.name as any) === "TypeDef";
    c.parent();
    return isVar;
  } else {
    return false;
  }
}

export function isFunDef(c: TreeCursor, s: string): boolean {
  return c.type.name === "FunctionDefinition";
}

export function isClassDef(c: TreeCursor, s: string): boolean {
  return c.type.name === "ClassDefinition";
}

export function traverse(c: TreeCursor, s: string): Program<Location> {
  var location: Location = getSourcePos(c, s);
  switch (c.node.type.name) {
    case "Script":
      const inits: Array<VarInit<Location>> = [];
      const funs: Array<FunDef<Location>> = [];
      const classes: Array<Class<Location>> = [];
      const stmts: Array<Stmt<Location>> = [];
      var hasChild = c.firstChild();

      while (hasChild) {
        if (isVarInit(c, s)) {
          inits.push(traverseVarInit(c, s));
        } else if (isFunDef(c, s)) {
          funs.push(traverseFunDef(c, s));
        } else if (isClassDef(c, s)) {
          classes.push(traverseClass(c, s));
        } else {
          break;
        }
        hasChild = c.nextSibling();
      }

      while (hasChild) {
        stmts.push(traverseStmt(c, s));
        hasChild = c.nextSibling();
      }
      c.parent();
      return { funs, inits, classes, stmts, a: location };
    default:
      throw new BaseException.CompileError(
        location,
        "Could not parse program at " + c.node.from + " " + c.node.to,
        "ParsingError"
      );
  }
}
export function parse(source: string): Program<Location> {
  const t = parser.parse(source);
  return traverse(t.cursor(), source);
}
