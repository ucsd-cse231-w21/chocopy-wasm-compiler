import {
  Stmt,
  Expr,
  UniOp,
  BinOp,
  Type,
  Program,
  Literal,
  FunDef,
  ClosureDef,
  VarInit,
  Class,
  Destructure,
  Location,
  Assignable,
} from "./ast";
import { NUM, BOOL, NONE, CLASS, STRING, unhandledTag, unreachable } from "./utils";
import * as BaseException from "./error";
import { forCount, lastCount } from "./parser";

// https://learnxinyminutes.com/docs/wasm/

// Numbers are offsets into global memory
export type GlobalEnv = {
  globals: Map<string, number>;
  classes: Map<string, Map<string, [number, Literal]>>;
  locals: Set<string>;
  offset: number;
  funs: Map<string, [number, Array<string>]>; // <function name, [tbl idx, Array of nonlocals]>
};

export const emptyEnv: GlobalEnv = {
  globals: new Map(),
  classes: new Map(),
  locals: new Set(),
  offset: 0,
  funs: new Map(),
};

export const nTagBits = 1;
const INT_LITERAL_MAX = BigInt(2 ** (31 - nTagBits) - 1);
const INT_LITERAL_MIN = BigInt(-(2 ** (31 - nTagBits)));

export const encodeLiteral: Array<string> = [
  `(i32.const ${nTagBits})`,
  "(i32.shl)",
  "(i32.const 1)", // literals are tagged with a 1 in the LSB
  "(i32.add)",
];

export const decodeLiteral: Array<string> = [`(i32.const ${nTagBits})`, "(i32.shr_s)"];

export function augmentEnv(env: GlobalEnv, prog: Program<[Type, Location]>): GlobalEnv {
  const newGlobals = new Map(env.globals);
  const newClasses = new Map(env.classes);
  const newFuns = new Map(env.funs);

  // set the referenced value to be num since we use i32 in wasm
  const RefMap = new Map<string, [number, Literal]>();
  RefMap.set("$deref", [0, { tag: "num", value: BigInt(0) }]);
  newClasses.set("$ref", RefMap);

  let newOffset = env.offset;

  let idx = newFuns.size;
  prog.closures.forEach((clo) => {
    newFuns.set(clo.name, [idx, clo.nonlocals]);
    idx += 1;
    if (clo.isGlobal) {
      newGlobals.set(clo.name, newOffset);
      newOffset += 1;
    }
  });

  prog.inits.forEach((v) => {
    newGlobals.set(v.name, newOffset);
    newOffset += 1;
  });
  // encoding for var rngi
  for (let index = lastCount + 1; index <= forCount; index++) {
    newGlobals.set("rng" + index, newOffset);
    newOffset += 1;
  }
  // set bars for indexing in for loops
  for (let index = lastCount + 1; index <= forCount; index++) {
    newGlobals.set("idx" + index, newOffset);
    newOffset += 1;
  }

  prog.classes.forEach((cls) => {
    const classFields = new Map();
    cls.fields.forEach((field, i) => classFields.set(field.name, [i, field.value]));
    newClasses.set(cls.name, classFields);
  });

  return {
    globals: newGlobals,
    classes: newClasses,
    locals: env.locals,
    offset: newOffset,
    funs: newFuns,
  };
}

// function envLookup(env: GlobalEnv, name: string): number {
//   if (!env.globals.has(name)) {
//     console.log("Could not find " + name + " in ", env);
//     throw new Error("Could not find name " + name);
//   }
//   return env.globals.get(name) * 4; // 4-byte values
// }

type CompileResult = {
  functions: string;
  mainSource: string;
  newEnv: GlobalEnv;
};

function myMemAlloc(name: string, size: number): Array<string> {
  const allocs: Array<string> = [];
  allocs.push(`(local.set ${name} (i32.load (i32.const 0))) ;; allocate memory for ${name}`);
  allocs.push(
    `(i32.store (i32.const 0) (i32.add (local.get ${name}) (i32.const ${
      size * 4
    }))) ;; update the heap ptr`
  );
  return allocs;
}

export function makeLocals(locals: Set<string>): Array<string> {
  const localDefines: Array<string> = [];
  locals.forEach((v) => {
    localDefines.push(`(local $${v} i32)`);
  });
  return localDefines;
}

//Any built-in WASM functions go here
export function libraryFuns(): string {
  return dictUtilFuns().join("\n");
}

export function makeId<A>(a: A, x: string): Destructure<A> {
  return {
    isDestructured: false,
    targets: [
      {
        target: { a: a, tag: "id", name: x },
        starred: false,
        ignore: false,
      },
    ],
  };
}

export function makeLookup<A>(a: A, obj: Expr<A>, field: string): Destructure<A> {
  return {
    isDestructured: false,
    targets: [
      {
        ignore: false,
        starred: false,
        target: {
          a: a,
          tag: "lookup",
          field: field,
          obj: obj,
        },
      },
    ],
    valueType: a,
  };
}

export function compile(ast: Program<[Type, Location]>, env: GlobalEnv): CompileResult {
  const withDefines = augmentEnv(env, ast);

  const definedVars: Set<string> = new Set(); //getLocals(ast);
  definedVars.add("$last");
  definedVars.add("$addr"); // address of the allocated memory
  definedVars.add("$list_base");
  definedVars.add("$list_index");
  definedVars.add("$list_temp");
  definedVars.add("$list_cmp");
  definedVars.add("$destruct");
  definedVars.add("$string_val"); //needed for string operations
  definedVars.add("$string_class"); //needed for strings in class
  definedVars.add("$string_index"); //needed for string index check out of bounds
  definedVars.add("$string_address"); //needed for string indexing
  definedVars.forEach(env.locals.add, env.locals);
  const localDefines = makeLocals(definedVars);

  const funs: Array<string> = [];
  ast.funs.forEach((f) => {
    funs.push(codeGenFunDef(f, withDefines).join("\n"));
  });

  ast.closures.forEach((clo) => {
    funs.push(codeGenClosureDef(clo, withDefines).join("\n"));
  });

  const globalFuns: Array<string> = [];
  ast.closures.forEach((clo) => {
    if (clo.isGlobal) {
      globalFuns.push(clo.name);
    }
  });
  const initFuns = initGlobalFuns(globalFuns, withDefines);

  const classes: Array<string> = ast.classes.map((cls) => codeGenClass(cls, withDefines)).flat();
  const allFuns = funs.concat(classes).join("\n\n");
  // const stmts = ast.filter((stmt) => stmt.tag !== "fun");

  const inits = ast.inits.map((init) => codeGenInit(init, withDefines)).flat();

  const commandGroups = ast.stmts.map((stmt) => codeGenStmt(stmt, withDefines));
  const commands = localDefines.concat(initFuns.concat(inits.concat(...commandGroups)));

  withDefines.locals.clear();

  return {
    functions: allFuns,
    mainSource: commands.join("\n"),
    newEnv: withDefines,
  };
}

function initGlobalFuns(funs: Array<string>, env: GlobalEnv): Array<string> {
  const inits: Array<string> = [];
  funs.forEach((fun) => {
    let fun_info = env.funs.get(fun);
    let idx = fun_info[0];
    let length = fun_info[1].length;
    let loc = envLookup(env, fun);
    inits.push(myMemAlloc(`$$addr`, length + 1).join("\n"));
    inits.push(`(i32.store (local.get $$addr) (i32.const ${idx})) ;; function idx`);
    inits.push(`(i32.store (i32.const ${loc}) (local.get $$addr)) ;; global function reference`);
  });

  // global functions have no nonlocals, assert length == 0
  return inits;
}

function myMemForward(n: number): Array<string> {
  const forward: Array<string> = [];
  forward.push(`;; update the heap ptr`);
  forward.push(`(i32.const 0)`);
  forward.push(`(i32.add (i32.load (i32.const 0)) (i32.const ${n * 4}))`);
  forward.push(`(i32.store)`);
  return forward;
}

function envLookup(env: GlobalEnv, name: string): number {
  //if(!env.globals.has(name)) { console.log("Could not find " + name + " in ", env); throw new Error("Could not find name " + name); }
  if (!env.globals.has(name)) {
    console.log("Could not find " + name + " in ", env);
    throw new BaseException.InternalException(
      "Report this as a bug to the compiler developer, this shouldn't happen "
    );
  }
  return env.globals.get(name) * 4; // 4-byte values
}

function codeGenStmt(stmt: Stmt<[Type, Location]>, env: GlobalEnv): Array<string> {
  switch (stmt.tag) {
    case "return":
      var valStmts = codeGenExpr(stmt.value, env);
      valStmts.push("return");
      return valStmts;
    case "assignment":
      const valueCode = codeGenExpr(stmt.value, env);
      const getValue = "(local.get $$destruct)";

      return [
        ...valueCode,
        "(local.set $$destruct)",
        ...codeGenDestructure(stmt.destruct, getValue, env),
      ];
    case "expr":
      var exprStmts = codeGenExpr(stmt.expr, env);
      return exprStmts.concat([`(local.set $$last)`]);
    case "if":
      var condExpr = codeGenExpr(stmt.cond, env).concat(decodeLiteral);
      var thnStmts = stmt.thn.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      var elsStmts = stmt.els.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      return [
        `${condExpr.join("\n")} \n (if (then ${thnStmts.join("\n")}) (else ${elsStmts.join(
          "\n"
        )}))`,
      ];
    case "while":
      var wcondExpr = codeGenExpr(stmt.cond, env).concat(decodeLiteral);
      var bodyStmts = stmt.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      return [
        `(block (loop (br_if 1 ${wcondExpr.join("\n")}\n(i32.eqz)) ${bodyStmts.join(
          "\n"
        )} (br 0) ))`,
      ];
    case "for":
      var bodyStmts = stmt.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      switch (stmt.iterable.tag) {
        case "id":
          // not handled yet
          return [];
        case "list-expr":
          var iass: Stmt<[Type, Location]> = {
            a: [NONE, stmt.a[1]],
            tag: "assignment",
            destruct: makeId([NUM, stmt.a[1]], "idx" + stmt.id),
            value: {
              a: [NUM, stmt.a[1]],
              tag: "literal",
              value: {
                tag: "num",
                value: BigInt(-1),
              },
            },
          };
          var Code_iass = codeGenStmt(iass, env);

          var nid: Expr<[Type, Location]> = {
            a: [NUM, stmt.a[1]],
            tag: "binop",
            op: BinOp.Plus,
            left: {
              a: [NUM, stmt.a[1]],
              tag: "id",
              name: "idx" + stmt.id,
            },
            right: {
              a: [NUM, stmt.a[1]],
              tag: "literal",
              value: {
                tag: "num",
                value: BigInt(1),
              },
            },
          };
          var niass: Stmt<[Type, Location]> = {
            a: [NONE, stmt.a[1]],
            tag: "assignment",
            destruct: makeId([NUM, stmt.a[1]], "idx" + stmt.id),
            value: nid,
          };
          var Code_idstep = codeGenStmt(niass, env);

          var list_lookup: Expr<[Type, Location]> = {
            a: [NUM, stmt.a[1]],
            tag: "bracket-lookup",
            obj: stmt.iterable,
            key: {
              a: [NUM, stmt.a[1]],
              tag: "id",
              name: "idx" + stmt.id,
            },
          };

          var tarname = "";
          if (stmt.name.targets[0].target.tag === "id") {
            tarname = stmt.name.targets[0].target.name;
          }
          // name = cur
          var ass: Stmt<[Type, Location]> = {
            a: [NONE, stmt.a[1]],
            tag: "assignment",
            destruct: makeId([NUM, stmt.a[1]], tarname),
            value: list_lookup,
          };
          var Code_ass = codeGenStmt(ass, env);

          // stop condition cur<step
          var Expr_cond: Expr<[Type, Location]> = {
            a: [BOOL, stmt.a[1]],
            tag: "binop",
            op: BinOp.Gte,
            left: {
              a: [NUM, stmt.a[1]],
              tag: "id",
              name: "idx" + stmt.id,
            },
            right: {
              a: [NUM, stmt.a[1]],
              tag: "literal",
              value: {
                tag: "num",
                value: BigInt(stmt.iterable.contents.length),
              },
            },
          };
          var Code_cond = codeGenExpr(Expr_cond, env);

          // if (stmt.index) {
          //   var idass: Stmt<[Type, Location]> = {
          //     a: [NONE, stmt.a[1]],
          //     tag: "assignment",
          //     destruct: makeId([NUM, stmt.a[1]], stmt.index),
          //     value: { a: [NUM, stmt.a[1]], tag: "id", name: "idx" + stmt.id },
          //   };
          //   var Code_idass = codeGenStmt(idass, env);
          //   return [
          //     `
          //     ${Code_iass.join("\n")}
          //
          //     (block
          //       (loop
          //         ${Code_idstep.join("\n")}
          //         (br_if 1 ${Code_cond.join("\n")} ${decodeLiteral.join("\n")})
          //
          //         ${Code_ass.join("\n")}
          //         ${Code_idass.join("\n")}
          //         ${bodyStmts.join("\n")}
          //         (br 0)
          //     ))`,
          //   ];
          // }

          return [
            `
            ${Code_iass.join("\n")}

            (block
              (loop
                ${Code_idstep.join("\n")}
                (br_if 1 ${Code_cond.join("\n")} ${decodeLiteral.join("\n")})

                ${Code_ass.join("\n")}
                ${bodyStmts.join("\n")}
                (br 0)
            ))`,
          ];
        case "call":
          // must be range()
          var iter = codeGenExpr(stmt.iterable, env);

          var rgExpr: Expr<[Type, Location]> = {
            a: [CLASS("Range"), stmt.a[1]],
            tag: "id",
            name: "rng" + stmt.id,
          };
          var Expr_cur: Expr<[Type, Location]> = {
            a: [NUM, stmt.a[1]],
            tag: "lookup",
            obj: rgExpr,
            field: "cur",
          };
          var Code_cur = codeGenExpr(Expr_cur, env);

          var Expr_stop: Expr<[Type, Location]> = {
            a: [NUM, stmt.a[1]],
            tag: "lookup",
            obj: rgExpr,
            field: "stop",
          };
          var Code_stop = codeGenExpr(Expr_stop, env);

          var Expr_step: Expr<[Type, Location]> = {
            a: [NUM, stmt.a[1]],
            tag: "lookup",
            obj: rgExpr,
            field: "step",
          };
          var Code_step_expr = codeGenExpr(Expr_step, env);

          // use cur-step to replace cur at the begining considering about continue
          var Expr_icur: Expr<[Type, Location]> = {
            a: [NUM, stmt.a[1]],
            tag: "binop",
            op: BinOp.Minus,
            left: Expr_cur,
            right: Expr_step,
          };

          var cur_ass: Stmt<[Type, Location]> = {
            a: [NONE, stmt.a[1]],
            tag: "assignment",
            destruct: makeLookup(rgExpr.a, rgExpr, "cur"),
            value: Expr_icur,
          };
          var Code_cur_iniass = codeGenStmt(cur_ass, env);

          var tarname = "";
          if (stmt.name.targets[0].target.tag === "id") {
            tarname = stmt.name.targets[0].target.name;
          }
          // name = cur
          var ass: Stmt<[Type, Location]> = {
            a: [NONE, stmt.a[1]],
            tag: "assignment",
            destruct: makeId([NUM, stmt.a[1]], tarname),
            value: Expr_cur,
          };
          var Code_ass = codeGenStmt(ass, env);

          // add step to cur
          var ncur: Expr<[Type, Location]> = {
            a: [NUM, stmt.a[1]],
            tag: "binop",
            op: BinOp.Plus,
            left: Expr_cur,
            right: Expr_step,
          };
          var step: Stmt<[Type, Location]> = {
            a: [NONE, stmt.a[1]],
            tag: "assignment",
            destruct: makeLookup(rgExpr.a, rgExpr, "cur"),
            value: ncur,
          };
          var Code_step = codeGenStmt(step, env);

          // stop condition cur<step
          var Expr_cond: Expr<[Type, Location]> = {
            a: [BOOL, stmt.a[1]],
            tag: "binop",
            op: BinOp.Gte,
            left: Expr_cur,
            right: Expr_stop,
          };
          var Code_cond = codeGenExpr(Expr_cond, env);

          // if have index
          // if (stmt.index) {
          //   var iass: Stmt<[Type, Location]> = {
          //     a: [NONE, stmt.a[1]],
          //     tag: "assignment",
          //     destruct: makeId([NUM, stmt.a[1]], stmt.index),
          //     value: { a: [NUM, stmt.a[1]], tag: "literal", value: { tag: "num", value: BigInt(-1) } },
          //   };
          //   var Code_iass = codeGenStmt(iass, env);
          //
          //   var nid: Expr<[Type, Location]> = {
          //     a: [NUM, stmt.a[1]],
          //     tag: "binop",
          //     op: BinOp.Plus,
          //     left: { a: [NUM, stmt.a[1]], tag: "id", name: stmt.index },
          //     right: { a: [NUM, stmt.a[1]], tag: "literal", value: { tag: "num", value: BigInt(1) } },
          //   };
          //   var niass: Stmt<[Type, Location]> = {
          //     a: [NONE, stmt.a[1]],
          //     tag: "assignment",
          //     destruct: makeId([NUM, stmt.a[1]], stmt.index),
          //     value: nid,
          //   };
          //   var Code_idstep = codeGenStmt(niass, env);
          //   // iterable should be a Range object
          //   return [
          //     `
          //     (i32.const ${envLookup(env, "rng" + stmt.id)})
          //     ${iter.join("\n")}
          //     (i32.store)
          //     ${Code_iass.join("\n")}
          //     ${Code_cur_iniass.join("\n")}
          //
          //     (block
          //       (loop
          //         ${Code_step.join("\n")}
          //         ${Code_idstep.join("\n")}
          //         (br_if 1 ${Code_cond.join("\n")} ${decodeLiteral.join("\n")})
          //
          //         ${Code_ass.join("\n")}
          //         ${bodyStmts.join("\n")}
          //         (br 0)
          //     ))`,
          //   ];
          // }
          // iterable should be a Range object
          // test
          // ${Code_cond.join("\n")}(call $print_bool)(local.set $$last)
          // ${Code_cur.join("\n")}(call $print_num)(local.set $$last)
          // ${Code_stop.join("\n")}(call $print_num)(local.set $$last)
          // ${Code_step_expr.join("\n")}(call $print_num)(local.set $$last)
          return [
            `
            (i32.const ${envLookup(env, "rng" + stmt.id)})
            ${iter.join("\n")}
            (i32.store)
            ${Code_cur_iniass.join("\n")}

            (block
              (loop
                ${Code_step.join("\n")}
                (br_if 1 ${Code_cond.join("\n")} ${decodeLiteral.join("\n")})

                ${Code_ass.join("\n")}
                ${bodyStmts.join("\n")}

                (br 0)
            ))`,
          ];
        default:
          throw new BaseException.InternalException("wrong tag for iterable");
      }
    case "pass":
      return [];
    case "break":
      // break to depth
      return [`(br ${stmt.depth})`];
    case "continue":
      return [`(br ${stmt.depth})`];
    default:
      unhandledTag(stmt);
  }
}

/**
 * Generate assign statements as described by the destructuring term
 * @param destruct Destructuring description of assign targets
 * @param value WASM code literal value for fetching the referenced value. E.g. "(local.get $$myValue)"
 * @param env GlobalEnv
 */
function codeGenDestructure(
  destruct: Destructure<[Type, Location]>,
  value: string,
  env: GlobalEnv
): string[] {
  let assignStmts: string[] = [];

  if (destruct.isDestructured) {
    const objTyp = destruct.valueType[0];
    if (objTyp.tag === "class") {
      const className = objTyp.name;
      const classFields = env.classes.get(className).values();
      // Collect every assignStmt

      assignStmts = destruct.targets.flatMap(({ target }) => {
        const [offset, _] = classFields.next().value;
        // The WASM code value that we extracted from the object at this current offset
        const addressOffset = offset * 4;
        const fieldValue = [`(i32.add ${value} (i32.const ${addressOffset}))`, `(i32.load)`];

        return codeGenAssignable(target, fieldValue, env);
      });
    } else {
      // Currently assumes that the valueType of our destructure is an object
      throw new BaseException.InternalException(
        "Destructuring not supported yet for types other than 'class'"
      );
    }
  } else {
    const target = destruct.targets[0];
    if (!target.ignore) {
      assignStmts = codeGenAssignable(target.target, [value], env);
    }
  }

  return assignStmts;
}

function codeGenAssignable(
  target: Assignable<[Type, Location]>,
  value: string[],
  env: GlobalEnv
): string[] {
  switch (target.tag) {
    case "id": // Variables
      if (env.locals.has(target.name)) {
        return [...value, `(local.set $${target.name})`];
      } else {
        const locationToStore = [`(i32.const ${envLookup(env, target.name)}) ;; ${target.name}`];
        return [...locationToStore, ...value, "(i32.store)"];
      }
    case "lookup": // Field lookup
      const objStmts = codeGenExpr(target.obj, env);
      const objTyp = target.obj.a[0];
      if (objTyp.tag !== "class") {
        // I don't think this error can happen
        throw new BaseException.InternalException(
          "Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag
        );
      }
      const className = objTyp.name;
      const [offset, _] = env.classes.get(className).get(target.field);
      if (target.field == "$deref") {
        return [...objStmts, ...value, `(i32.store)`];
      } else {
        return [...objStmts, `(i32.add (i32.const ${offset * 4}))`, ...value, `(i32.store)`];
      }
    case "bracket-lookup":
      switch (target.obj.a[0].tag) {
        case "dict":
          return codeGenExpr(target.obj, env).concat(codeGenDictKeyVal(target.key, value, 10, env));
        case "list":
        default:
          throw new BaseException.InternalException(
            "Bracket-assign for types other than dict not implemented"
          );
      }
    default:
      // Force type error if assignable is added without implementation
      // At the very least, there should be a stub
      const err: never = <never>target;
      throw new BaseException.InternalException(`Unknown target ${JSON.stringify(err)} (compiler)`);
  }
}

function codeGenInit(init: VarInit<[Type, Location]>, env: GlobalEnv): Array<string> {
  const value = codeGenLiteral(init.value);
  if (env.locals.has(init.name)) {
    return [...value, `(local.set $${init.name})`];
  } else {
    const locationToStore = [
      `(i32.const ${envLookup(env, init.name)}) ;; global variable ${init.name}`,
    ];
    return locationToStore.concat(value).concat([`(i32.store)`]);
  }
}

function initNested(nested: Array<string>, env: GlobalEnv): Array<string> {
  // this is where the closures are constructed, except for global closures
  // the accesses of callable variables does not create a closure
  const inits: Array<string> = [];

  nested.forEach((fun) => {
    inits.push(myMemAlloc(`$${fun}_$ref`, 1).join("\n"));
  });

  nested.forEach((fun) => {
    let [idx, nonlocals] = env.funs.get(fun);
    inits.push(myMemAlloc(`$$addr`, nonlocals.length + 1).join("\n"));
    inits.push(`(i32.store (local.get $$addr) (i32.const ${idx})) ;; function idx`);
    nonlocals.forEach((v, i) => {
      // the dependent variable 'v' exists in the parent scope
      inits.push(
        `(i32.store (i32.add (local.get $$addr) (i32.const ${(i + 1) * 4})) (local.get $${v}_$ref))`
      );
    });
    inits.push(`(i32.store (local.get $${fun}_$ref) (local.get $$addr))`);
  });

  return inits;
}

const fPTR = "$$fPTR"; // the first extra argument

function initNonlocals(nonlocals: Array<string>): Array<string> {
  // extract the references for nonlocals from the '$fPTR'
  const inits: Array<string> = [];
  nonlocals.forEach((v, i) => {
    inits.push(`(i32.load (i32.add (local.get ${fPTR}) (i32.const ${(i + 1) * 4})))`);
    inits.push(`(local.set $${v}_$ref)`);
  });

  return inits;
}

function initRef(refs: Set<string>): Array<string> {
  // for parameters and local variables, extra references are created and initialized
  const inits: Array<string> = [];
  refs.forEach((name) => {
    inits.push(myMemAlloc(`$${name}_$ref`, 1).join("\n"));
    inits.push(`(i32.store (local.get $${name}_$ref) (local.get $${name}))`);
  });

  return inits;
}

function codeGenClosureDef(def: ClosureDef<[Type, Location]>, env: GlobalEnv): Array<string> {
  const definedVars: Set<string> = new Set();
  definedVars.add("$last");
  definedVars.add("$addr");
  definedVars.add("$destruct");
  definedVars.add("$string_val"); //needed for string operations
  definedVars.add("$string_class"); //needed for strings in class
  definedVars.add("$string_index"); //needed for string index check out of bounds
  definedVars.add("$string_address"); //needed for string indexing
  def.nonlocals.forEach((v) => definedVars.add(`${v}_$ref`)); // nonlocals are reference, ending with '_$ref'
  def.nested.forEach((f) => definedVars.add(`${f}_$ref`)); // nested functions are references of function ptrs, ending with _$ref
  // ToDo, optimize after EA
  def.inits.forEach((v) => definedVars.add(`${v.name}`));
  def.inits.forEach((v) => definedVars.add(`${v.name}_$ref`));
  def.parameters.forEach((p) => definedVars.add(`${p.name}_$ref`));

  // references that required memory allocation
  const extraRefs: Set<string> = new Set();
  def.inits.forEach((v) => extraRefs.add(`${v.name}`));
  def.parameters.forEach((p) => extraRefs.add(`${p.name}`));

  definedVars.forEach(env.locals.add, env.locals);
  def.parameters.forEach((p) => env.locals.add(p.name));

  const localDefs = makeLocals(definedVars).join("\n");
  const inits = def.inits
    .map((init) => codeGenInit(init, env))
    .flat()
    .join("\n");
  const refs = initRef(extraRefs).join("\n");
  const nonlocals = initNonlocals(def.nonlocals).join("\n");
  const nested = initNested(def.nested, env).join("\n");

  let params = def.parameters.map((p) => `(param $${p.name} i32)`).join(" ");
  let stmts = def.body
    .map((stmt) => codeGenStmt(stmt, env))
    .flat()
    .join("\n");

  env.locals.clear();

  return [
    `(func $${def.name} (param ${fPTR} i32) ${params} (result i32)
${localDefs}
${inits}
${refs}
${nonlocals}
${nested}
${stmts}
(i32.const 0)
(return)
)`,
  ];
}

function codeGenFunDef(def: FunDef<[Type, Location]>, env: GlobalEnv): Array<string> {
  var definedVars: Set<string> = new Set();
  def.inits.forEach((v) => definedVars.add(v.name));
  definedVars.add("$last");
  definedVars.add("$destruct");
  definedVars.add("$string_val"); //needed for string operations
  definedVars.add("$string_class"); //needed for strings in class
  definedVars.add("$string_index"); //needed for string index check out of bounds
  definedVars.add("$string_address"); //needed for string indexing
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

function codeGenClass(cls: Class<[Type, Location]>, env: GlobalEnv): Array<string> {
  const methods = [...cls.methods];
  methods.forEach((method) => (method.name = `${cls.name}$${method.name}`));
  const result = methods.map((method) => codeGenFunDef(method, env));
  return result.flat();
}

// If concat is 0, then the function generate code for list.copy()
// If concat is 2, then the function generate code for concat.
function codeGenListCopy(concat: number): Array<string> {
  var stmts: Array<string> = [];
  var loopstmts: Array<string> = [];
  var condstmts: Array<string> = [];
  var listType = 10; //temporary list type number
  var header = [4, 8]; //size, bound relative position
  stmts.push(...[`(local.set $$list_cmp)`]); //store first address to local var
  stmts.push(...[`(i32.load (i32.const 0))`, `(local.set $$list_base)`]); //store the starting address for the new list
  if (concat != 1)
    stmts.push(...[`(local.get $$list_base)`, "(i32.const " + listType + ")", "(i32.store)"]); //create a new list with type

  //check if the current index has reached the size of the list
  condstmts.push(
    ...[
      `(local.get $$list_cmp)`,
      `(i32.add (i32.const 4))`,
      `(i32.load)`,
      `(local.get $$list_index)`,
      `(i32.eq)`,
    ]
  );

  //statement for loop through the compared list and add the elements to the new list
  loopstmts.push(
    ...[
      `(local.get $$list_base)`,
      `(i32.add (i32.const 12))`,
      `(local.get $$list_index)`,
      concat == 1 ? `(i32.add (local.get $$list_temp))` : ``,
      `(i32.mul (i32.const 4))`,
      `(i32.add)`,
      `(local.get $$list_cmp)`,
      `(i32.add (i32.const 12))`,
      `(local.get $$list_index)`,
      `(i32.mul (i32.const 4))`,
      `(i32.add)`,
      `(i32.load)`,
      `(i32.store)`,
      `(local.get $$list_index)`,
      `(i32.add (i32.const 1))`,
      `(local.set $$list_index)`,
    ]
  );

  if (concat == 1) {
    stmts.push(
      ...[
        `(local.get $$list_base)`,
        `(i32.add (i32.const 4))`,
        `(i32.load)`,
        `(local.set $$list_temp)`,
      ]
    );
  }

  //while loop structure
  stmts.push(
    ...[
      `(i32.const 0)`,
      `(local.set $$list_index)`,
      `(block`,
      `(loop`,
      `(br_if 1 ${condstmts.join("\n")})`,
      `${loopstmts.join("\n")}`,
      `(br 0)`,
      `)`,
      `)`,
    ]
  );

  //add/modify header info of the list
  header.forEach((addr) => {
    var stmt = null;
    if (concat == 1) {
      stmt = [
        `(local.get $$list_base)`,
        `(i32.add (i32.const ${addr}))`,
        `(local.get $$list_base)`,
        `(i32.add (i32.const ${addr}))`,
        `(i32.load)`,
        `(local.get $$list_cmp)`,
        `(i32.add (i32.const ${addr}))`,
        `(i32.load)`,
        `(i32.add)`,
        `(i32.store)`,
      ];
    } else {
      stmt = [
        `(local.get $$list_base)`,
        `(i32.add (i32.const ${addr}))`,
        `(local.get $$list_cmp)`,
        `(i32.add (i32.const ${addr}))`,
        `(i32.load)`,
        `(i32.store)`,
      ];
    }
    stmts.push(...stmt);
  });

  if (concat == 2) return stmts.concat(codeGenListCopy(1));

  return stmts.concat([
    `(local.get $$list_base)`, // Get address for the object (this is the return value)
    "(i32.const 0)", // Address for our upcoming store instruction
    `(local.get $$list_base)`, // Load the dynamic heap head offset
    `(local.get $$list_cmp)`,
    `(i32.add (i32.const 8))`,
    `(i32.load)`,
    `(i32.mul (i32.const 4))`,
    `(i32.add (i32.const 12))`,
    `(i32.add)`,
    "(i32.store)", // Save the new heap offset
  ]);
}

function codeGenExpr(expr: Expr<[Type, Location]>, env: GlobalEnv): Array<string> {
  switch (expr.tag) {
    case "builtin1":
      const argTyp = expr.a[0];
      const argStmts = codeGenExpr(expr.arg, env);
      var callName = expr.name;
      if (expr.name === "print" && argTyp === NUM) {
        callName = "print_num";
      } else if (expr.name === "print" && argTyp === STRING) {
        callName = "print_str";
      } else if (expr.name === "print" && argTyp === BOOL) {
        return argStmts.concat([`(call $print_bool)`]);
      } else if (expr.name === "print" && argTyp === NONE) {
        return argStmts.concat([`(call $print_none)`]);
      }
      return argStmts.concat([`(call $${callName})`]);
    case "builtin2":
      const leftStmts = codeGenExpr(expr.left, env);
      const rightStmts = codeGenExpr(expr.right, env);
      // we will need to check with the built-in functions team to determine how BigNumbers will interface with the built-in functions
      return [
        ...leftStmts,
        ...decodeLiteral,
        ...rightStmts,
        ...decodeLiteral,
        `(call $${expr.name})`,
        ...encodeLiteral,
      ];
    case "literal":
      return codeGenLiteral(expr.value);
    case "id":
      if (env.locals.has(expr.name)) {
        return [`(local.get $${expr.name}) ;; local ${expr.name}`];
      } else {
        return [`(i32.const ${envLookup(env, expr.name)})`, `(i32.load)`];
      }
    case "binop":
      const lhsStmts = codeGenExpr(expr.left, env);
      const rhsStmts = codeGenExpr(expr.right, env);
      if (typeof expr.left.a !== "undefined" && expr.left.a[0].tag === "list") {
        return [...rhsStmts, ...lhsStmts, ...codeGenListCopy(2)];
      } else if (expr.op == BinOp.Is) {
        return [...lhsStmts, ...rhsStmts, codeGenBinOp(expr.op), ...encodeLiteral];
      } else {
        return [
          ...lhsStmts,
          ...decodeLiteral,
          ...rhsStmts,
          ...decodeLiteral,
          codeGenBinOp(expr.op),
          ...encodeLiteral,
        ];
      }
    case "uniop":
      const exprStmts = codeGenExpr(expr.expr, env);
      switch (expr.op) {
        case UniOp.Neg:
          return [...exprStmts, "(call $$bignum_neg)"];
        case UniOp.Not:
          return [`(i32.const 0)`, ...exprStmts, ...decodeLiteral, `(i32.eq)`, ...encodeLiteral];
        default:
          return unreachable(expr);
      }
    case "call":
      if (expr.name === "range") {
        switch (expr.arguments.length) {
          case 1:
            var valStmts = [`(i32.const 1)`];
            valStmts = valStmts.concat(expr.arguments.map((arg) => codeGenExpr(arg, env)).flat());
            valStmts.push(`(i32.const 3)`);
            valStmts.push(`(call $${expr.name})`);
            return valStmts;
          case 2:
            var valStmts = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
            valStmts.push(`(i32.const 3)`);
            valStmts.push(`(call $${expr.name})`);
            return valStmts;
          case 3:
            var valStmts = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
            valStmts.push(`(call $${expr.name})`);
            return valStmts;
          default:
            throw new Error("Unsupported range() call!");
        }
      }
      var valStmts = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
      valStmts.push(`(call $${expr.name})`);
      return valStmts;
    case "call_expr":
      const callExpr: Array<string> = [];
      const nameExpr = expr.name;
      let funName: string;
      if (nameExpr.tag == "id") {
        // until now, all the function variables are wrapped in references
        // the 'id's serves for global functions
        funName = nameExpr.name;
        callExpr.push(`(i32.load (i32.const ${envLookup(env, funName)})) ;; argument for $fPTR`);
        expr.arguments.forEach((arg) => {
          callExpr.push(codeGenExpr(arg, env).join("\n"));
        });
        callExpr.push(
          `(call_indirect (type $callType${
            expr.arguments.length + 1
          }) (i32.load (i32.load (i32.const ${envLookup(env, funName)}))))`
        );
      } else if (nameExpr.tag == "lookup") {
        funName = (nameExpr.obj as any).name;
        callExpr.push(`(i32.load (local.get $${funName})) ;; argument for $fPTR`);
        expr.arguments.forEach((arg) => {
          callExpr.push(codeGenExpr(arg, env).join("\n"));
        });
        callExpr.push(
          `(call_indirect (type $callType${
            expr.arguments.length + 1
          }) (i32.load (i32.load (local.get $${funName}))))`
        );
      } else if (nameExpr.tag == "call_expr") {
        callExpr.push(codeGenExpr(nameExpr, env).join("\n"));
        callExpr.push(`(local.set $$addr)`);
        callExpr.push(`(local.get $$addr) ;; function ptr for the extra argument`);
        expr.arguments.forEach((arg) => {
          callExpr.push(codeGenExpr(arg, env).join("\n"));
        });
        callExpr.push(
          `(call_indirect (type $callType${
            expr.arguments.length + 1
          }) (i32.load (local.get $$addr)))`
        );
      } else {
        throw new BaseException.InternalException(
          `Compile Error. Invalid name of tag ${nameExpr.tag}`
        );
      }
      return callExpr;
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
      let clsName = (expr.obj.a[0] as any).name;
      if (env.classes.get(clsName).has(expr.method)) {
        let callExpr: Array<string> = [];
        let argsExprs = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
        callExpr.push(codeGenExpr(expr.obj, env).join("\n"));
        callExpr.push(`(i32.add (i32.const ${env.classes.get(clsName).get(expr.method)[0] * 4}))`);
        callExpr.push(`(i32.load) ;; load the function pointer for the extra argument`);
        callExpr.push(argsExprs.join("\n"));
        callExpr.push(codeGenExpr(expr.obj, env).join("\n"));
        callExpr.push(`(i32.add (i32.const ${env.classes.get(clsName).get(expr.method)[0] * 4}))`);
        callExpr.push(`(i32.load) ;; load the function pointer`);
        callExpr.push(`(i32.load) ;; load the function index`);
        callExpr.push(`(call_indirect (type $callType${expr.arguments.length + 1}))`);
        return callExpr;
      } else {
        var objStmts = codeGenExpr(expr.obj, env);
        var objTyp = expr.obj.a[0];
        if (objTyp.tag !== "class") {
          // I don't think this error can happen
          throw new BaseException.InternalException(
            "Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag
          );
        }
        var className = objTyp.name;
        var argsStmts = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
        return [...objStmts, ...argsStmts, `(call $${className}$${expr.method})`];
      }
    case "lookup":
      var objStmts = codeGenExpr(expr.obj, env);
      var objTyp = expr.obj.a[0];
      if (objTyp.tag !== "class") {
        // I don't think this error can happen
        throw new BaseException.InternalException(
          "Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag
        );
      }
      var className = objTyp.name;
      var [offset, _] = env.classes.get(className).get(expr.field);
      if (expr.field == "$deref") {
        return [...objStmts, `(i32.load) ;; dereference`];
      } else {
        return [...objStmts, `(i32.add (i32.const ${offset * 4}))`, `(i32.load)`];
      }
    case "dict":
      let dictStmts: Array<string> = [];
      //Allocate memory on the heap for hashtable. Currently size is 10
      //It finally pushes address of dict on stack, ie the return value
      dictStmts = dictStmts.concat(codeGenDictAlloc(10, env, expr.entries.length));
      expr.entries.forEach((keyval) => {
        const value = codeGenExpr(keyval[1], env);
        dictStmts = dictStmts.concat(codeGenDictKeyVal(keyval[0], value, 10, env));
      });
      return dictStmts;
    case "list-expr":
      var stmts: Array<string> = [];
      var listType = 10;
      var listSize = expr.contents.length;
      var listBound = (expr.contents.length + 10) * 2;
      let listHeader = [listType, listSize, listBound];
      var listindex = 0;
      expr.contents
        .slice()
        .reverse()
        .forEach((lexpr) => {
          stmts.push(...[...codeGenExpr(lexpr, env)]);
        });

      listHeader.forEach((val) => {
        stmts.push(
          ...[
            `(i32.load (i32.const 0))`,
            `(i32.add (i32.const ${listindex * 4}))`,
            "(i32.const " + val + ")",
            "(i32.store)",
          ]
        );
        listindex += 1;
      });

      expr.contents.forEach((lexpr) => {
        stmts.push(
          ...[
            `(local.set $$list_temp)`,
            `(i32.load (i32.const 0))`,
            `(i32.add (i32.const ${listindex * 4}))`,
            `(local.get $$list_temp)`,
            "(i32.store)",
          ]
        );
        listindex += 1;
      });

      //Move heap head to the end of the list and return list address
      return stmts.concat([
        "(i32.load (i32.const 0))",
        "(i32.const 0)",
        "(i32.load (i32.const 0))",
        `(i32.add (i32.const ${(listBound + 3) * 4}))`,
        "(i32.store)",
      ]);

    case "bracket-lookup":
      switch (expr.obj.a[0].tag) {
        case "dict":
          return codeGenDictBracketLookup(expr.obj, expr.key, 10, env);
        case "string":
          var brObjStmts = codeGenExpr(expr.obj, env);
          var brKeyStmts = codeGenExpr(expr.key, env);
          var brStmts = [];
          brStmts.push(
            ...[
              `${brObjStmts.join("\n")}`, //Load the string object to be indexed
              `(local.set $$string_address)`,
              `${brKeyStmts.join("\n")}`, //Gets the index
              ...decodeLiteral,
              `(local.set $$string_index)`,
              `(local.get $$string_index)`,
              `(i32.const 0)(i32.lt_s)`, //check for negative index
              `(if (then (local.get $$string_address)(i32.load)(i32.add (i32.const 1))(local.get $$string_index)(i32.add)(local.set $$string_index)))`, //if -ve, we do length + index
              `(local.get $$string_index)(local.get $$string_address)(i32.load)(i32.gt_s)`, //Check for +ve index out of bounds
              `(local.get $$string_index)(i32.const 0)(i32.lt_s)`, //Check for -ve index out of bounds
              `(i32.or)`, // Check if string index is within bounds, i.e, b/w 0 and string_length
              `(if (then (i32.const -1)(call $print_str)(drop)))`, //Check if string index is out of bounds
              `(local.get $$string_address)`,
              `(i32.add (i32.mul (i32.const 4)(local.get $$string_index)))`, //Add the index * 4 value to the address
              `(i32.add (i32.const 4))`, //Adding 4 since string length is at first index
              `(i32.load)`, //Load the ASCII value of the string index
              `(local.set $$string_val)`, //store value in temp variable
              `(i32.load (i32.const 0))`, //load value at 0
              `(i32.const 0)`, //Length of string is 1
              `(i32.store)`, //Store length of string in the first position
              `(i32.load (i32.const 0))`, //Load latest free memory
              `(i32.add (i32.const 4))`, //Add 4 since we have stored string length at beginning
              `(local.get $$string_val)`, //load value in temp variable
              "(i32.store)", //Store the ASCII value in the new address
            ]
          );
          brStmts.push(
            ...[
              "(i32.load (i32.const 0))", // Get address for the indexed character of the string
              "(i32.const 0)", // Address for our upcoming store instruction
              "(i32.load (i32.const 0))", // Load the dynamic heap head offset
              `(i32.add (i32.const 8))`, // Move heap head beyond the string length
              "(i32.store)", // Save the new heap offset
            ]
          );
          return brStmts;
        case "list":
          var objStmts = codeGenExpr(expr.obj, env);
          //This should eval to a number
          //Multiply it by 4 to use as offset in memory
          var keyStmts = codeGenExpr(expr.key, env);
          //Add 3 to keyStmts to jump over type + size + bound
          //Add that to objStmts base address
          //Load from there
          return objStmts.concat(
            //TODO check for IndexOutOfBounds
            //Coordinate with error group
            /*
            [
              `(i32.add (i32.4)) ;; retrieve list size`,
              `(i32.load)`,
            // size > index
            ],
              keyStmts,
            [
              `(i32.gt_s) ;; compare list size > index`
              `(if (then (call $error)) (else (nop))) ;; call IndexOutOfBounds`
            ],
              objStmts, //reload list base addr & key stmts?
            */
            keyStmts,
            [
              ...decodeLiteral,
              `(i32.mul (i32.const 4))`,
              `(i32.add (i32.const 12)) ;; move past type, size, bound`,
              `(i32.add) ;; retrieve element location`,
              `(i32.load) ;; load list element`,
            ]
          );
        default:
          throw new BaseException.InternalException(
            "Code gen for bracket-lookup for types other than dict not implemented"
          );
      }
    default:
      unhandledTag(expr);
  }
}

function codeGenDictAlloc(hashtableSize: number, env: GlobalEnv, entries: number): Array<string> {
  let dictAllocStmts: Array<string> = [];
  //Ideally this loop should be replaced by call to allocator API to allocate hashtablesize entries on heap.
  for (let i = 0; i < hashtableSize; i++) {
    dictAllocStmts.push(
      ...[
        `(i32.load (i32.const 0))`, // Load the dynamic heap head offset
        `(i32.add (i32.const ${i * 4}))`, // Calc hash table entry offset from heap offset
        ...codeGenLiteral({ tag: "none" }), // CodeGen for "none" literal
        "(i32.store)", // Initialize to none
      ]
    );
  }
  //Push the base address of dict on the stack to be consumed by each of the key:val pair initialization
  for (let i = 0; i < entries; i++) {
    dictAllocStmts = dictAllocStmts.concat(["(i32.load (i32.const 0))"]);
  }
  return dictAllocStmts.concat([
    "(i32.load (i32.const 0))", // Get address for the dict (this is the return value)
    "(i32.const 0)", // Address for our upcoming store instruction
    "(i32.load (i32.const 0))", // Load the dynamic heap head offset
    `(i32.add (i32.const ${hashtableSize * 4}))`, // Increment heap offset according to hashtable size
    "(i32.store)", // Save the new heap offset
  ]);
}

function allocateStringMemory(string_val: string): Array<string> {
  const stmts = [];
  var i = 1;
  //Storing the length of the string at the beginning
  stmts.push(
    ...[
      `(i32.load (i32.const 0))`, // Load the dynamic heap head offset
      `(i32.const ${string_val.length - 1})`, // Store ASCII value for 0 (end of string)
      "(i32.store)", // Store the ASCII value 0 in the new address
    ]
  );
  while (i != string_val.length + 1) {
    const char_ascii = string_val.charCodeAt(i - 1);
    stmts.push(
      ...[
        `(i32.load (i32.const 0))`, // Load the dynamic heap head offset
        `(i32.add (i32.const ${i * 4}))`, // Calc string index offset from heap offset
        `(i32.const ${char_ascii})`, // Store the ASCII value of the string index
        "(i32.store)", // Store the ASCII value in the new address
      ]
    );
    i += 1;
  }
  return stmts.concat([
    "(i32.load (i32.const 0))", // Get address for the first character of the string
    "(i32.const 0)", // Address for our upcoming store instruction
    "(i32.load (i32.const 0))", // Load the dynamic heap head offset
    `(i32.add (i32.const ${(string_val.length + 1) * 4}))`, // Move heap head beyond the string length + 1(len at beginning)
    "(i32.store)", // Save the new heap offset
  ]);
}

function codeGenDictBracketLookup(
  obj: Expr<[Type, Location]>,
  key: Expr<[Type, Location]>,
  hashtableSize: number,
  env: GlobalEnv
): Array<string> {
  let dictKeyValStmts: Array<string> = [];
  dictKeyValStmts = dictKeyValStmts.concat(codeGenExpr(obj, env));
  dictKeyValStmts = dictKeyValStmts.concat(codeGenExpr(key, env));
  dictKeyValStmts = dictKeyValStmts.concat([
    `(i32.const ${hashtableSize})`,
    "(call $ha$htable$Lookup)",
  ]);
  return dictKeyValStmts.concat(["i32.load"]);
}

//Assumes that base address of dict is pushed onto the stack already
function codeGenDictKeyVal(
  key: Expr<[Type, Location]>,
  val: string[],
  hashtableSize: number,
  env: GlobalEnv
): Array<string> {
  let dictKeyValStmts: Array<string> = [];
  dictKeyValStmts = dictKeyValStmts.concat(codeGenExpr(key, env));
  dictKeyValStmts = dictKeyValStmts.concat(val);
  dictKeyValStmts = dictKeyValStmts.concat([
    `(i32.const ${hashtableSize})`,
    "(call $ha$htable$Update)",
  ]);
  return dictKeyValStmts;
}

function dictUtilFuns(): Array<string> {
  let dictFunStmts: Array<string> = [];
  dictFunStmts.push(
    ...[
      "(func $ha$htable$CreateEntry (param $key i32) (param $val i32)",
      "(i32.load (i32.const 0))", // Loading the address of first empty space
      "(local.get $key)",
      "(i32.store)", // Dumping tag
      "(i32.load (i32.const 0))", // Loading the address of first empty space
      "(i32.const 4)",
      "(i32.add)", // Moving to the next block
      "(local.get $val)",
      "(i32.store)", // Dumping value
      "(i32.load (i32.const 0))", // Loading the address of first empty space
      "(i32.const 8)",
      "(i32.add)", // Moving to the next block
      "(i32.const 0)", //None
      "(i32.store)", // Dumping None in the next
      "(return))",
      "",
    ]
  );

  //This function returns a memory address for the value of a key. It returns -1 if not found.
  dictFunStmts.push(
    ...[
      "(func $ha$htable$Lookup (param $baseAddr i32) (param $key i32) (param $hashtablesize i32) (result i32)",
      "(local $nodePtr i32)", // Local variable to store the address of nodes in linkedList
      "(local $tagHitFlag i32)", // Local bool variable to indicate whether tag is hit
      "(local $returnVal i32)",
      "(i32.const -1)",
      "(local.set $returnVal)", // Initialize returnVal to -1
      "(i32.const 0)",
      "(local.set $tagHitFlag)", // Initialize tagHitFlag to False
      "(local.get $baseAddr)",
      "(local.get $key)",
      "(local.get $hashtablesize)",
      "(i32.rem_s)", //Compute hash
      "(i32.mul (i32.const 4))", //Multiply by 4 for memory offset
      "(i32.add)", //Reaching the proper bucket. Call this bucketAddress
      "(i32.load)",
      "(local.set $nodePtr)",
      "(local.get $nodePtr)",
      "(i32.const 0)", //None
      "(i32.eq)",
      "(if",
      "(then", // if the literal in bucketAddress is None
      "(i32.const -1)",
      "(local.set $returnVal)", // Initialize returnVal to -1
      ")", //close then
      "(else",
      "(block",
      "(loop", // While loop till we find a node whose next is None
      "(local.get $nodePtr)",
      "(i32.load)", // Traversing to head of next node
      "(i32.const 0)", //None
      "(i32.ne)", // If nodePtr not None
      "(if",
      "(then",
      "(local.get $nodePtr)",
      "(i32.load)", //Loading head of linkedList
      "(local.get $key)",
      "(i32.eq)", // if tag is same as the provided one
      "(if",
      "(then",
      "(local.get $nodePtr)",
      "(i32.const 4)",
      "(i32.add)", // Value
      "(local.set $returnVal)",
      "(i32.const 1)",
      "(local.set $tagHitFlag)", // Set tagHitFlag to True
      ")", // closing then
      ")", // closing if
      "(local.get $nodePtr)",
      "(i32.const 8)",
      "(i32.add)", // Next pointer
      "(i32.load)",
      "(local.set $nodePtr)",
      ")", // Closing then
      ")", // Closing if
      "(br_if 0", // Opening br_if
      "(local.get $nodePtr)",
      "(i32.const 0)", //None
      "(i32.ne)", // If nodePtr not None
      "(local.get $tagHitFlag)",
      "(i32.eqz)",
      "(i32.and)",
      ")", // Closing br_if
      "(br 1)",
      ")", // Closing loop
      ")", // Closing Block
      ")", //close else
      ")", // close if
      "(local.get $returnVal)",
      "(return))",
      "",
    ]
  );

  dictFunStmts.push(
    ...[
      "(func $ha$htable$Update (param $baseAddr i32) (param $key i32) (param $val i32) (param $hashtablesize i32)",
      "(local $nodePtr i32)", // Local variable to store the address of nodes in linkedList
      "(local $tagHitFlag i32)", // Local bool variable to indicate whether tag is hit
      "(i32.const 0)",
      "(local.set $tagHitFlag)", // Initialize tagHitFlag to False
      "(local.get $baseAddr)",
      "(local.get $key)",
      "(local.get $hashtablesize)",
      "(i32.rem_s)", //Compute hash
      "(i32.mul (i32.const 4))", //Multiply by 4 for memory offset
      "(i32.add)", //Reaching the proper bucket. Call this bucketAddress
      "(i32.load)",
      "(i32.const 0)", //None
      "(i32.eq)",
      "(if",
      "(then", // if the literal in bucketAddress is None
      "(local.get $key)",
      "(local.get $val)",
      "(call $ha$htable$CreateEntry)", //create node
      "(local.get $baseAddr)", // Recomputing the bucketAddress to update it.
      "(local.get $key)",
      "(local.get $hashtablesize)",
      "(i32.rem_s)", //Compute hash
      "(i32.mul (i32.const 4))", //Multiply by 4 for memory offset
      "(i32.add)", //Recomputed bucketAddress
      "(i32.load (i32.const 0))",
      "(i32.store)", //Updated the bucketAddress pointing towards first element.
      "(i32.const 0)",
      "(i32.load (i32.const 0))",
      "(i32.const 12)",
      "(i32.add)",
      "(i32.store)", // Updating the empty space address in first block
      ")", // Closing then
      "(else", // Opening else
      "(local.get $baseAddr)", // Recomputing the bucketAddress to follow the linkedList.
      "(local.get $key)",
      "(local.get $hashtablesize)",
      "(i32.rem_s)", //Compute hash
      "(i32.mul (i32.const 4))", //Multiply by 4 for memory offset
      "(i32.add)", //Recomputed bucketAddress
      "(i32.load)", //Loading head of linkedList
      "(i32.load)", //Loading the tag of head
      "(local.get $key)",
      "(i32.eq)",
      "(if", // if tag is same as the provided one
      "(then",
      "(local.get $baseAddr)", // Recomputing the bucketAddress to follow the linkedList.
      "(local.get $key)",
      "(local.get $hashtablesize)",
      "(i32.rem_s)", //Compute hash
      "(i32.mul (i32.const 4))", //Multiply by 4 for memory offset
      "(i32.add)", //Recomputed bucketAddress
      "(i32.load)", //Loading head of linkedList
      "(i32.const 4)",
      "(i32.add)", // Value
      "(local.get $val)",
      "(i32.store)", // Updating the value
      "(i32.const 1)",
      "(local.set $tagHitFlag)", // Set tagHitFlag to True
      ")", // closing then
      ")", // closing if
      "(local.get $baseAddr)", // Recomputing the bucketAddress to follow the linkedList.
      "(local.get $key)",
      "(local.get $hashtablesize)",
      "(i32.rem_s)", //Compute hash
      "(i32.mul (i32.const 4))", //Multiply by 4 for memory offset
      "(i32.add)", //Recomputed bucketAddress
      "(i32.load)", //Loading head of linkedList
      "(i32.const 8)",
      "(i32.add)", // Next pointer
      "(local.set $nodePtr)",
      "(block",
      "(loop", // While loop till we find a node whose next is None
      "(local.get $nodePtr)",
      "(i32.load)", // Traversing to head of next node
      "(i32.const 0)", //None
      "(i32.ne)", // If nodePtr not None
      "(if",
      "(then",
      "(local.get $nodePtr)",
      "(i32.load)", //Loading head of linkedList
      "(i32.load)", //Loading the tag of head
      "(local.get $key)",
      "(i32.eq)", // if tag is same as the provided one
      "(if",
      "(then",
      "(local.get $nodePtr)",
      "(i32.load)", //Loading head of linkedList
      "(i32.const 4)",
      "(i32.add)", // Value
      "(local.get $val)",
      "(i32.store)", // Updating the value
      "(i32.const 1)",
      "(local.set $tagHitFlag)", // Set tagHitFlag to True
      ")", // closing then
      ")", // closing if
      "(local.get $nodePtr)",
      "(i32.load)", //Loading head of linkedList
      "(i32.const 8)",
      "(i32.add)", // Next pointer
      "(local.set $nodePtr)",
      ")", // Closing then
      ")", // Closing if
      "(br_if 0", // Opening br_if
      "(local.get $nodePtr)",
      "(i32.load)", // Traversing to head of next node
      "(i32.const 0)", //None
      "(i32.ne)", // If nodePtr not None
      ")", // Closing br_if
      "(br 1)",
      ")", // Closing loop
      ")", // Closing Block
      "(local.get $tagHitFlag)",
      "(i32.const 0)",
      "(i32.eq)", // Add a new node only if tag hit is false.
      "(if",
      "(then",
      "(local.get $key)",
      "(local.get $val)",
      "(call $ha$htable$CreateEntry)", //create node
      "(local.get $nodePtr)", // Get the address of "next" block in node, whose next is None.
      "(i32.load (i32.const 0))",
      "(i32.store)", // Updated the next pointing towards first element of new node.
      "(i32.const 0)",
      "(i32.load (i32.const 0))",
      "(i32.const 12)",
      "(i32.add)",
      "(i32.store)", // Updating the empty space address in first block
      ")", // Closing then inside else
      ")", // Closing if inside else
      ")", // Closing else
      ")", // Closing if
      "(return))", //
    ]
  );
  return dictFunStmts;
}

function codeGenBigInt(num: bigint): Array<string> {
  const WORD_SIZE = 4;
  const mask = BigInt(0x7fffffff);
  var sign = 1;
  var size = 0;
  // fields ? [(0, sign), (1, size)]
  if (num < 0n) {
    sign = 0;
    num *= -1n;
  }
  var words: bigint[] = [];
  do {
    words.push(num & mask);
    num >>= 31n;
    size += 1;
  } while (num > 0n);
  // size MUST be > 0
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
    case "string":
      return allocateStringMemory(literal.value);
    case "num":
      if (literal.value <= INT_LITERAL_MAX && literal.value >= INT_LITERAL_MIN) {
        return [`(i32.const ${literal.value})`, ...encodeLiteral];
      } else {
        return codeGenBigInt(literal.value);
      }
    case "bool":
      return [`(i32.const ${Number(literal.value)})`, ...encodeLiteral];
    case "none":
      return [`(i32.const 0)`];
    default:
      unhandledTag(literal);
  }
}

function codeGenBinOp(op: BinOp): string {
  switch (op) {
    case BinOp.Plus:
      return "(i32.add)";
    case BinOp.Minus:
      return "(i32.sub)";
    case BinOp.Mul:
      return "(i32.mul)";
    case BinOp.IDiv:
      return "(i32.div_s)";
    case BinOp.Mod:
      return "(i32.rem_s)";
    case BinOp.Eq:
      return "(i32.eq)";
    case BinOp.Neq:
      return "(i32.ne)";
    case BinOp.Lte:
      return "(i32.le_s)";
    case BinOp.Gte:
      return "(i32.ge_s)";
    case BinOp.Lt:
      return "(i32.lt_s)";
    case BinOp.Gt:
      return "(i32.gt_s)";
    case BinOp.Is:
      return "(i32.eq)";
    case BinOp.And:
      return "(i32.and)";
    case BinOp.Or:
      return "(i32.or)";
  }
}
