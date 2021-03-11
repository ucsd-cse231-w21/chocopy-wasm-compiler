import {
  Stmt,
  Expr,
  UniOp,
  BinOp,
  Type,
  Program,
  Literal,
  FunDef,
  VarInit,
  Class,
} from "./ast";
import {
  NUM,
  BOOL,
  NONE,
  INT_LITERAL_MAX,
  INT_LITERAL_MIN,
  nTagBits,
  bigintToWords,
} from "./utils";
import * as BaseException from "./error";

// https://learnxinyminutes.com/docs/wasm/

// Numbers are offsets into global memory
export type GlobalEnv = {
  globals: Map<string, number>;
  classes: Map<string, Map<string, [number, Literal]>>;
  locals: Set<string>;
  offset: number;
};

export const emptyEnv: GlobalEnv = {
  globals: new Map(),
  classes: new Map(),
  locals: new Set(),
  offset: 0,
};

export const encodeLiteral: Array<string> = [
  `(i32.const ${nTagBits})`,
  "(i32.shl)",
  "(i32.const 1)", // literals are tagged with a 1 in the LSB
  "(i32.add)",
];

export const decodeLiteral: Array<string> = [
  `(i32.const ${nTagBits})`,
  "(i32.shr_s)",
];

export function augmentEnv(env: GlobalEnv, prog: Program<Type>): GlobalEnv {
  const newGlobals = new Map(env.globals);
  const newClasses = new Map(env.classes);

  var newOffset = env.offset;
  prog.inits.forEach((v) => {
    newGlobals.set(v.name, newOffset);
    newOffset += 1;
  });
  prog.classes.forEach((cls) => {
    const classFields = new Map();
    cls.fields.forEach((field, i) =>
      classFields.set(field.name, [i, field.value])
    );
    newClasses.set(cls.name, classFields);
  });
  return {
    globals: newGlobals,
    classes: newClasses,
    locals: env.locals,
    offset: newOffset,
  };
}

type CompileResult = {
  functions: string;
  mainSource: string;
  newEnv: GlobalEnv;
};

// export function getLocals(ast : Array<Stmt>) : Set<string> {
//   const definedVars : Set<string> = new Set();
//   ast.forEach(s => {
//     switch(s.tag) {
//       case "define":
//         definedVars.add(s.name);
//         break;
//     }
//   });
//   return definedVars;
// }

export function makeLocals(locals: Set<string>): Array<string> {
  const localDefines: Array<string> = [];
  locals.forEach((v) => {
    localDefines.push(`(local $${v} i32)`);
  });
  return localDefines;
}

export function compile(ast: Program<Type>, env: GlobalEnv): CompileResult {
  const withDefines = augmentEnv(env, ast);

  const definedVars: Set<string> = new Set(); //getLocals(ast);
  definedVars.add("$last");
  definedVars.add("$string_class"); //needed for strings in class
  definedVars.forEach(env.locals.add, env.locals);
  const localDefines = makeLocals(definedVars);
  const funs: Array<string> = [];
  ast.funs.forEach((f) => {
    funs.push(codeGenDef(f, withDefines).join("\n"));
  });
  const classes: Array<string> = ast.classes
    .map((cls) => codeGenClass(cls, withDefines))
    .flat();
  const allFuns = funs.concat(classes).join("\n\n");
  // const stmts = ast.filter((stmt) => stmt.tag !== "fun");
  const inits = ast.inits.map((init) => codeGenInit(init, withDefines)).flat();
  const commandGroups = ast.stmts.map((stmt) => codeGenStmt(stmt, withDefines));
  const commands = localDefines.concat(
    inits.concat([].concat.apply([], commandGroups))
  );
  withDefines.locals.clear();
  return {
    functions: allFuns,
    mainSource: commands.join("\n"),
    newEnv: withDefines,
  };
}

function envLookup(env: GlobalEnv, name: string): number {
  if (!env.globals.has(name)) {
    console.log("Could not find " + name + " in ", env);
    throw new Error("Could not find name " + name);
  }
  return env.globals.get(name) * 4; // 4-byte values
}

function codeGenStmt(stmt: Stmt<Type>, env: GlobalEnv): Array<string> {
  switch (stmt.tag) {
    // case "fun":
    //   const definedVars = getLocals(stmt.body);
    //   definedVars.add("$last");
    //   stmt.parameters.forEach(p => definedVars.delete(p.name));
    //   definedVars.forEach(env.locals.add, env.locals);
    //   stmt.parameters.forEach(p => env.locals.add(p.name));

    //   const localDefines = makeLocals(definedVars);
    //   const locals = localDefines.join("\n");
    //   var params = stmt.parameters.map(p => `(param $${p.name} i32)`).join(" ");
    //   var stmts = stmt.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
    //   var stmtsBody = stmts.join("\n");
    //   env.locals.clear();
    //   return [`(func $${stmt.name} ${params} (result i32)
    //     ${locals}
    //     ${stmtsBody}
    //     (i32.const 0)
    //     (return))`];
    case "return":
      var valStmts = codeGenExpr(stmt.value, env);
      valStmts.push("return");
      return valStmts;
    case "assignment":
      throw new Error("Destructured assignment not implemented");
    case "assign":
      var valStmts = codeGenExpr(stmt.value, env);
      if (env.locals.has(stmt.name)) {
        return valStmts.concat([`(local.set $${stmt.name})`]);
      } else {
        const locationToStore = [
          `(i32.const ${envLookup(env, stmt.name)}) ;; ${stmt.name}`,
        ];
        return locationToStore.concat(valStmts).concat([`(i32.store)`]);
      }
    case "expr":
      var exprStmts = codeGenExpr(stmt.expr, env);
      return exprStmts.concat([`(local.set $$last)`]);
    case "if":
      var condExpr = codeGenExpr(stmt.cond, env).concat(decodeLiteral);
      var thnStmts = stmt.thn
        .map((innerStmt) => codeGenStmt(innerStmt, env))
        .flat();
      var elsStmts = stmt.els
        .map((innerStmt) => codeGenStmt(innerStmt, env))
        .flat();
      return [
        `${condExpr.join("\n")} \n (if (then ${thnStmts.join(
          "\n"
        )}) (else ${elsStmts.join("\n")}))`,
      ];
    case "while":
      var wcondExpr = codeGenExpr(stmt.cond, env).concat(decodeLiteral);
      var bodyStmts = stmt.body
        .map((innerStmt) => codeGenStmt(innerStmt, env))
        .flat();
      return [
        `(block (loop  ${bodyStmts.join("\n")} (br_if 0 ${wcondExpr.join(
          "\n"
        )}) (br 1) ))`,
      ];
    case "pass":
      return [];
    case "field-assign":
      var objStmts = codeGenExpr(stmt.obj, env);
      var objTyp = stmt.obj.a;
      if (objTyp.tag !== "class") {
        // I don't think this error can happen
        throw new Error(
          "Report this as a bug to the compiler developer, this shouldn't happen " +
            objTyp.tag
        );
      }
      var className = objTyp.name;
      var [offset, _] = env.classes.get(className).get(stmt.field);
      var valStmts = codeGenExpr(stmt.value, env);
      return [
        ...objStmts,
        `(i32.add (i32.const ${offset * 4}))`,
        ...valStmts,
        `(i32.store)`,
      ];
  }
}

function codeGenInit(init: VarInit<Type>, env: GlobalEnv): Array<string> {
  const value = codeGenLiteral(init.value);
  if (env.locals.has(init.name)) {
    return [...value, `(local.set $${init.name})`];
  } else {
    const locationToStore = [
      `(i32.const ${envLookup(env, init.name)}) ;; ${init.name}`,
    ];
    return locationToStore.concat(value).concat([`(i32.store)`]);
  }
}

function codeGenDef(def: FunDef<Type>, env: GlobalEnv): Array<string> {
  var definedVars: Set<string> = new Set();
  def.inits.forEach((v) => definedVars.add(v.name));
  definedVars.add("$last");
  // def.parameters.forEach(p => definedVars.delete(p.name));
  definedVars.forEach(env.locals.add, env.locals);
  def.parameters.forEach((p) => env.locals.add(p.name));

  const localDefines = makeLocals(definedVars);
  const locals = localDefines.join("\n");
  const inits = def.inits
    .map((init) => codeGenInit(init, env))
    .flat()
    .join("\n");
  var params = def.parameters.map((p) => `(param $${p.name} i32)`).join(" ");
  var stmts = def.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
  var stmtsBody = stmts.join("\n");
  env.locals.clear();
  return [
    `(func $${def.name} ${params} (result i32)
    ${locals}
    ${inits}
    ${stmtsBody}
    (i32.const 0)
    (return))`,
  ];
}

function codeGenClass(cls: Class<Type>, env: GlobalEnv): Array<string> {
  const methods = [...cls.methods];
  methods.forEach((method) => (method.name = `${cls.name}$${method.name}`));
  const result = methods.map((method) => codeGenDef(method, env));
  return result.flat();
}

function codeGenExpr(expr: Expr<Type>, env: GlobalEnv): Array<string> {
  switch (expr.tag) {
    case "builtin1":
      const argTyp = expr.a;
      const argStmts = codeGenExpr(expr.arg, env);
      var callName = expr.name;
      if (expr.name === "print" && argTyp === NUM) {
        callName = "print_num";
      } else if (expr.name === "print" && argTyp === BOOL) {
        callName = "print_bool";
      } else if (expr.name === "print" && argTyp === NONE) {
        callName = "print_none";
      }
      return argStmts.concat([`(call $${callName})`]);
    case "builtin2":
      const leftStmts = codeGenExpr(expr.left, env);
      const rightStmts = codeGenExpr(expr.right, env);
      return [...leftStmts, ...rightStmts, `(call $${expr.name})`];
    case "literal":
      return codeGenLiteral(expr.value);
    case "id":
      if (env.locals.has(expr.name)) {
        return [`(local.get $${expr.name})`];
      } else {
        return [`(i32.const ${envLookup(env, expr.name)})`, `(i32.load)`];
      }
    case "binop":
      const lhsStmts = codeGenExpr(expr.left, env);
      const rhsStmts = codeGenExpr(expr.right, env);
      if (expr.op == BinOp.Is) {
        return [
          ...lhsStmts,
          ...rhsStmts,
          codeGenBinOp(expr.op),
          ...encodeLiteral,
        ];
      } else if (expr.op == BinOp.And || expr.op == BinOp.Or) {
        return [
          ...lhsStmts,
          ...decodeLiteral,
          ...rhsStmts,
          ...decodeLiteral,
          codeGenBinOp(expr.op),
          ...encodeLiteral,
        ];
      } else {
        return [...lhsStmts, ...rhsStmts, codeGenBinOp(expr.op)];
      }
    case "uniop":
      const exprStmts = codeGenExpr(expr.expr, env);
      switch (expr.op) {
        case UniOp.Neg:
          return [...exprStmts, "(call $$bignum_neg)"];
        case UniOp.Not:
          return [
            `(i32.const 0)`,
            ...exprStmts,
            ...decodeLiteral,
            `(i32.eq)`,
            ...encodeLiteral,
          ];
      }
      break;
    case "call":
      var valStmts = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
      valStmts.push(`(call $${expr.name})`);
      return valStmts;
    case "construct":
      var stmts: Array<string> = [];
      stmts.push(
        ...[
          "(i32.const 0) ;; to store the updated heap ptr", // Address for our upcoming store instruction
          "(i32.load (i32.const 0))", // Load the dynamic heap head offset
          "(local.set $$string_class)",
          "(i32.load (i32.const 0))",
          `(i32.add (i32.const ${env.classes.get(expr.name).size * 4}))`, // Move heap head beyond the k words we just created for fields
          "(i32.store) ;; to store the updated heap ptr", // Save the new heap offset
        ]
      );
      env.classes.get(expr.name).forEach(([offset, initVal], field) =>
        stmts.push(
          ...[
            `(local.get $$string_class) ;; object address for ${expr.name}`,
            `(i32.add (i32.const ${offset * 4})) ;; offset for ${field}`, // Calc field offset from heap offset
            ...codeGenLiteral(initVal), // Initialize field
            `(i32.store) ;; store for ${field}`, // Put the default field value on the heap
          ]
        )
      );
      stmts.push(
        ...[
          "(local.get $$string_class)",
          `(call $${expr.name}$__init__)`, // call __init__
          "(drop)",
          "(local.get $$string_class) ;; return the address of the constructed object",
        ]
      );
      return stmts;
    case "method-call":
      var objStmts = codeGenExpr(expr.obj, env);
      var objTyp = expr.obj.a;
      if (objTyp.tag !== "class") {
        // I don't think this error can happen
        throw new Error(
          "Report this as a bug to the compiler developer, this shouldn't happen " +
            objTyp.tag
        );
      }
      var className = objTyp.name;
      var argsStmts = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
      return [...objStmts, ...argsStmts, `(call $${className}$${expr.method})`];
    case "lookup":
      var objStmts = codeGenExpr(expr.obj, env);
      var objTyp = expr.obj.a;
      if (objTyp.tag !== "class") {
        // I don't think this error can happen
        throw new Error(
          "Report this as a bug to the compiler developer, this shouldn't happen " +
            objTyp.tag
        );
      }
      var className = objTyp.name;
      var [offset, _] = env.classes.get(className).get(expr.field);
      return [...objStmts, `(i32.add (i32.const ${offset * 4}))`, `(i32.load)`];
  }
}

function codeGenBigInt(num: bigint): Array<string> {
  const WORD_SIZE = 4;
  var [sign, size, words] = bigintToWords(num);
  var alloc = [
    // eventually we will be able to call something like alloc(size+2)
    "(i32.load (i32.const 0))", // Load dynamic heap head offset
    `(i32.add (i32.const ${0 * WORD_SIZE}))`, // add space for sign field
    `(i32.const ${sign})`,
    "(i32.store)", // store sign val
    "(i32.load (i32.const 0))", // Load dynamic heap head offset
    `(i32.add (i32.const ${1 * WORD_SIZE}))`, // move offset another 4 for size
    `(i32.const ${size})`, // size is only 32 bits :(
    "(i32.store)", // store size
  ];
  words.forEach((w, i) => {
    alloc = alloc.concat([
      "(i32.load (i32.const 0))", // Load dynamic heap head offset
      `(i32.add (i32.const ${(2 + i) * WORD_SIZE}))`, // advance pointer
      `(i32.const ${w})`,
      ...encodeLiteral,
      "(i32.store)", // store
    ]);
  });
  alloc = alloc.concat([
    "(i32.const 0)", // where will we store the updated heap offset
    "(i32.load (i32.const 0))", // Load dynamic heap head offset
    `(i32.add (i32.const ${(2 + size) * WORD_SIZE}))`, // this is how much space we need
    "(i32.store)", // store new offset
    "(i32.load (i32.const 0))", // reload offset
    `(i32.sub (i32.const ${(2 + size) * WORD_SIZE}))`, // this is the addr for the number
  ]);
  console.log(words, size, sign);
  return alloc;
}

function codeGenLiteral(literal: Literal): Array<string> {
  switch (literal.tag) {
    case "num":
      if (
        literal.value <= INT_LITERAL_MAX &&
        literal.value >= INT_LITERAL_MIN
      ) {
        return [`(i32.const ${literal.value})`, ...encodeLiteral];
      } else {
        return codeGenBigInt(literal.value);
      }
    case "bool":
      return [`(i32.const ${Number(literal.value)})`, ...encodeLiteral];
    case "none":
      return [`(i32.const 0)`];
  }
}

function codeGenBinOp(op: BinOp): string {
  switch (op) {
    case BinOp.Plus:
      return "(call $$add)";
    case BinOp.Minus:
      return "(call $$sub)";
    case BinOp.Mul:
      return "(call $$mul)";
    case BinOp.IDiv:
      return "(call $$div)";
    case BinOp.Mod:
      return "(call $$mod)";
    case BinOp.Eq:
      return "(call $$eq)";
    case BinOp.Neq:
      return "(call $$ne)";
    case BinOp.Lte:
      return "(call $$lte)";
    case BinOp.Gte:
      return "(call $$gte)";
    case BinOp.Lt:
      return "(call $$lt)";
    case BinOp.Gt:
      return "(call $$gt)";
    case BinOp.Is:
      return "(i32.eq)";
    case BinOp.And:
      return "(i32.and)";
    case BinOp.Or:
      return "(i32.or)";
  }
}
