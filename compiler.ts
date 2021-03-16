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
  AssignTarget,
  Location,
  Assignable,
} from "./ast";
import {
  NUM,
  BOOL,
  NONE,
  CLASS,
  STRING,
  unhandledTag,
  unreachable,
  WithTag,
  bigintToWords,
} from "./utils";
import * as BaseException from "./error";
import { RunTime } from "./errorManager";
import {
  MemoryManager,
  TAG_BIGINT,
  TAG_CLASS,
  TAG_CLOSURE,
  TAG_DICT,
  TAG_DICT_ENTRY,
  TAG_LIST,
  TAG_OPAQUE,
  TAG_REF,
  TAG_STRING,
  TAG_TUPLE,
} from "./alloc";
import { augmentFnGc } from "./compiler-gc";
import { defaultMaxListeners } from "stream";

// https://learnxinyminutes.com/docs/wasm/

// Numbers are offsets into global memory
export type GlobalEnv = {
  globals: Map<string, number>;
  classes: Map<string, Map<string, [number, Literal]>>;
  locals: Map<string, number>; // Map from local/param to stack slot index
  funs: Map<string, [number, Array<string>]>; // <function name, [tbl idx, Array of nonlocals]>
};

export const emptyEnv: GlobalEnv = {
  globals: new Map(),
  classes: new Map(),
  locals: new Map(),
  funs: new Map(),
};

const FENCE_TEMPS = 2;
const RELEASE_TEMPS = 1;
const HOLD_TEMPS = 0;

export const nTagBits = 1;
const INT_LITERAL_MAX = BigInt(2 ** (31 - nTagBits) - 1);
const INT_LITERAL_MIN = BigInt(-(2 ** (31 - nTagBits)));

export enum ListContentTag {
  Num = 0,
  Bool,
  None,
  Str,
  Class,
  List,
  Dict,
  Callable,
}

enum ListCopyMode {
  Copy = 0,
  Slice,
  Double,
  Concat,
}

export const encodeLiteral: Array<string> = [
  `(i32.const ${nTagBits})`,
  "(i32.shl)",
  "(i32.const 1)", // literals are tagged with a 1 in the LSB
  "(i32.add)",
];

export const decodeLiteral: Array<string> = [`(i32.const ${nTagBits})`, "(i32.shr_s)"];

export function augmentEnv(
  env: GlobalEnv,
  prog: Program<[Type, Location]>,
  mm: MemoryManager
): GlobalEnv {
  const newGlobals = new Map(env.globals);
  const newClasses = new Map(env.classes);
  const newFuns = new Map(env.funs);

  // set the referenced value to be num since we use i32 in wasm
  const RefMap = new Map<string, [number, Literal]>();
  RefMap.set("$deref", [0, { tag: "num", value: BigInt(0) }]);
  newClasses.set("$ref", RefMap);

  let idx = newFuns.size;
  prog.closures.forEach((clo) => {
    newFuns.set(clo.name, [idx, clo.nonlocals]);
    idx += 1;
    if (clo.isGlobal) {
      const globalAddr = mm.staticAlloc(4n);
      newGlobals.set(clo.name, Number(globalAddr));
    }
  });

  prog.inits.forEach((v) => {
    // Allocate static memory for the global variable
    // NOTE(alex:mm) assumes that allocations return a 32-bit address
    const globalAddr = mm.staticAlloc(4n);
    console.log(`global var '${v.name}' addr: ${globalAddr.toString()}`);
    newGlobals.set(v.name, Number(globalAddr));
    mm.addGlobal(globalAddr);
  });

  // for rg
  const rgAddr = mm.staticAlloc(4n);
  newGlobals.set("rg", Number(rgAddr));
  mm.addGlobal(rgAddr);

  prog.classes.forEach((cls) => {
    const classFields = new Map();
    cls.fields.forEach((field, i) => classFields.set(field.name, [i, field.value]));
    newClasses.set(cls.name, classFields);
  });

  return {
    globals: newGlobals,
    classes: newClasses,
    locals: env.locals,
    funs: newFuns,
  };
}

type CompileResult = {
  functions: string;
  mainSource: string;
  newEnv: GlobalEnv;
};

export function makeLocals(locals: Set<string>): Array<string> {
  const localDefines: Array<string> = [];
  locals.forEach((v) => {
    localDefines.push(`(local $${v} i32)`);
  });
  return localDefines;
}

//Any built-in WASM functions go here
export function libraryFuns(): string {
  var libfunc = dictUtilFuns().join("\n") + "\n" + stringUtilFuns().join("\n");
  libfunc += "\n" + listBuiltInFuns().join("\n");
  return libfunc;
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

export function compile(
  ast: Program<[Type, Location]>,
  env: GlobalEnv,
  mm: MemoryManager
): CompileResult {
  const withDefines = augmentEnv(env, ast, mm);

  let stackIndexOffset = 0; // NOTE(alex:mm): assumes start function has no params
  const definedVars: Set<string> = new Set(); //getLocals(ast);
  definedVars.add("$last");
  definedVars.add("$allocPointer"); // Used to cache the result of `gcalloc`
  definedVars.add("$addr"); // address of the allocated memory
  definedVars.add("$list_base");
  definedVars.add("$list_index");
  definedVars.add("$list_index2");
  definedVars.add("$list_temp");
  definedVars.add("$list_size");
  definedVars.add("$list_bound");
  definedVars.add("$list_cmp");
  definedVars.add("$list_cmp2");
  definedVars.add("$destruct");
  definedVars.add("$destructListOffset");
  definedVars.add("$string_val"); //needed for string operations
  definedVars.add("$string_class"); //needed for strings in class
  definedVars.add("$string_index"); //needed for string index check out of bounds
  definedVars.add("$string_address"); //needed for string indexing
  definedVars.add("$slice_start"); //needed for string slicing
  definedVars.add("$slice_end"); //needed for string slicing
  definedVars.add("$slice_stride"); //needed for string slicing
  definedVars.add("$counter"); //needed for string slicing
  definedVars.add("$length"); //needed for string slicing
  definedVars.forEach((v) => {
    env.locals.set(v, stackIndexOffset);
    stackIndexOffset += 1;
  });
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
  const augmentedCommands = augmentFnGc(commands, withDefines.locals, {
    main: true,
    debug: {
      name: "entry",
    },
  });
  withDefines.locals.clear();

  return {
    functions: allFuns,
    mainSource: augmentedCommands.join("\n"),
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
    inits.push(...myMemAlloc(`$$addr`, length + 1, true));
    inits.push(`(i32.store (local.get $$addr) (i32.const ${idx})) ;; function idx`);
    inits.push(`(i32.store (i32.const ${loc}) (local.get $$addr)) ;; global function reference`);
  });

  // global functions have no nonlocals, assert length == 0
  return inits;
}

function envLookup(env: GlobalEnv, name: string): number {
  //if(!env.globals.has(name)) { console.log("Could not find " + name + " in ", env); throw new Error("Could not find name " + name); }
  if (!env.globals.has(name)) {
    console.log("Could not find " + name + " in ", env);
    throw new BaseException.InternalException(
      "Report this as a bug to the compiler developer, this shouldn't happen "
    );
  }
  // NOTE(alex:mm): ADDRESS of the global variable is store in the environment
  return env.globals.get(name);
}

function codeGenStmt(stmt: Stmt<[Type, Location]>, env: GlobalEnv): Array<string> {
  switch (stmt.tag) {
    case "return":
      var valStmts = codeGenTempGuard(codeGenExpr(stmt.value, env), FENCE_TEMPS);
      valStmts.push("(return)");
      return valStmts;
    case "assignment":
      const valueCode = codeGenExpr(stmt.value, env);
      const getValue = "(local.get $$destruct)";

      // TODO(alex): make more granular?
      return codeGenTempGuard(
        [
          ...valueCode,
          "(local.set $$destruct)",
          ...codeGenDestructure(stmt.destruct, getValue, env),
        ],
        FENCE_TEMPS
      );
    case "expr":
      var exprStmts = codeGenExpr(stmt.expr, env);
      return codeGenTempGuard(exprStmts.concat([`(local.set $$last)`]), FENCE_TEMPS);
    case "if":
      // TODO(alex:mm): Are these temporary guards correct/minimal?
      var condExpr = codeGenTempGuard(
        codeGenExpr(stmt.cond, env).concat(decodeLiteral),
        FENCE_TEMPS
      );
      var thnStmts = stmt.thn.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      var elsStmts = stmt.els.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      return condExpr
        .concat(["(if (then"])
        .concat(thnStmts)
        .concat([")", "(else"])
        .concat(elsStmts)
        .concat(["))"]);
    case "while":
      var wcondExpr = codeGenTempGuard(
        codeGenExpr(stmt.cond, env).concat(decodeLiteral),
        FENCE_TEMPS
      );
      var bodyStmts = stmt.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      return ["(block (loop (br_if 1"]
        .concat(wcondExpr)
        .concat(["(i32.eqz))"])
        .concat(bodyStmts)
        .concat(["(br 0) ))"]);
    case "for":
      var bodyStmts = stmt.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      var iter = codeGenExpr(stmt.iterable, env);

      var rgExpr: Expr<[Type, Location]> = {
        a: [CLASS("Range"), stmt.a[1]],
        tag: "id",
        name: "rg",
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

      // name = cur
      var ass: Stmt<[Type, Location]> = {
        a: [NONE, stmt.a[1]],
        tag: "assignment",
        destruct: makeId([NUM, stmt.a[1]], stmt.name),
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
        a: rgExpr.a,
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
      if (stmt.index) {
        var iass: Stmt<[Type, Location]> = {
          a: [NONE, stmt.a[1]],
          tag: "assignment",
          destruct: makeId([NUM, stmt.a[1]], stmt.index),
          value: { a: [NUM, stmt.a[1]], tag: "literal", value: { tag: "num", value: BigInt(0) } },
        };
        var Code_iass = codeGenStmt(iass, env);

        var nid: Expr<[Type, Location]> = {
          a: [NUM, stmt.a[1]],
          tag: "binop",
          op: BinOp.Plus,
          left: { a: [NUM, stmt.a[1]], tag: "id", name: stmt.index },
          right: { a: [NUM, stmt.a[1]], tag: "literal", value: { tag: "num", value: BigInt(1) } },
        };
        var niass: Stmt<[Type, Location]> = {
          a: [NONE, stmt.a[1]],
          tag: "assignment",
          destruct: makeId([NUM, stmt.a[1]], stmt.index),
          value: nid,
        };
        var Code_idstep = codeGenStmt(niass, env);
        // iterable should be a Range object
        return codeGenTempGuard(
          [
            `(i32.const ${envLookup(env, "rg")})`,
            ...iter,
            `(i32.store)`,
            ...Code_iass,
            "(block",
            "(loop",
            ...Code_step,
            ...Code_idstep,
            ...["(bf_if 1", ...Code_cond, ...decodeLiteral, "))"],
            ...Code_ass,
            ...bodyStmts,
            "(br 0)",
            "))",
          ],
          FENCE_TEMPS
        );
      }
      // iterable should be a Range object
      // test
      // ${Code_cond.join("\n")}(call $print_bool)(local.set $$last)
      // ${Code_cur.join("\n")}(call $print_num)(local.set $$last)
      // ${Code_stop.join("\n")}(call $print_num)(local.set $$last)
      // ${Code_step_expr.join("\n")}(call $print_num)(local.set $$last)
      return codeGenTempGuard(
        [
          `(i32.const ${envLookup(env, "rg")})`,
          ...iter,
          `(i32.store)`,
          `(block`,
          `  (loop`,
          ...Code_step,
          ...[`(br_if 1 `, ...Code_cond, ...decodeLiteral, ")"],
          ...Code_ass,
          ...bodyStmts,
          `(br 0)`,
          `))`,
        ],
        FENCE_TEMPS
      );
    case "pass":
      return [];
    case "break":
      // break to depth
      return [`(br ${stmt.depth})`];
    case "continue":
      console.log(stmt);
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
    switch (objTyp.tag) {
      // TODO: Remove class-based destructuring in the long term, leave for now until it can be safely removed
      case "class": {
        const className = objTyp.name;
        const classFields = env.classes.get(className).values();

        // Collect every assignStmt
        assignStmts = destruct.targets.flatMap((target) => {
          const assignable = target.target;
          if (target.starred) {
            throw new Error("Do not currently support starred assignment targets for objects");
          } else {
            const [offset, _] = classFields.next().value;
            // The WASM code value that we extracted from the object at this current offset
            const addressOffset = offset * 4;
            const fieldValue = [value, `(i32.load offset=${addressOffset})`];
            return codeGenAssignable(assignable, fieldValue, env);
          }
        });
        break;
      }
      case "tuple": {
        let offset = 0;

        assignStmts = destruct.targets.flatMap((target) => {
          const assignable = target.target;
          if (target.starred) {
            throw new Error("Do not currently support starred assignment targets for tuples");
          } else {
            const fieldValue = [value, `(i32.load offset=${offset})`];
            offset += 4;
            return codeGenAssignable(assignable, fieldValue, env);
          }
        });
        break;
      }
      case "list": {
        // Determines if we have a single target with starred == true
        // used to run a different runtime length check
        const isStarred = destruct.targets.some((target) => target.starred);

        let targetListLength: number;
        let compareLengthOperator: string;
        if (isStarred) {
          // Targets list length - 1 is the lower bound for number of required elements in our array
          // The array can be larger/equal to this (because of star operator) but not smaller
          targetListLength = destruct.targets.length - 1;
          compareLengthOperator = `(i32.ge_u)`;
        } else {
          // No star operator simply means the target lists and the runtime list must be same length
          targetListLength = destruct.targets.length;
          compareLengthOperator = `(i32.eq)`;
        }
        // TODO: Add nice runtime error instead of "RuntimeError: unreachable"
        const lengthCheck = [
          value,
          `(i32.load offset=4)`, // list length, stored at byte offset 4
          `(i32.const ${targetListLength})`, // number of destruct targets
          compareLengthOperator,
          `(if (then (nop)) (else (unreachable)))`,
          //`(if (then (nop)) (else (call $SomeExitingErrorFunction)))`
        ];

        // Skip past the three header values of lists and to the actual values
        let initalizeOffset = [`(i32.const 12)`, `(local.set $$destructListOffset)`];
        let offset = [`(local.get $$destructListOffset)`];
        const targetStmts = destruct.targets.flatMap((target) => {
          const assignable = target.target;
          if (target.starred) {
            //throw new Error("Star operator not implemented yet.");

            // The starting index of the star operator
            // subtracting the 12 for the header values, dividing by 4 to convert from byte offset to index in list
            const startStarIndex = [`(i32.div_s (i32.sub ${offset} (i32.const 12)) (i32.const 4))`];

            let nonStarredElements = destruct.targets.length - 1;
            // The WASM number of elements we need in our starred element list
            const numStarElements = [
              value,
              `(i32.load offset=4)`, // list length, stored at byte offset 4
              `(i32.const ${nonStarredElements})`,
              `(i32.sub)`, // results in the number of elements needed in the starred list
            ];
            // The ending index of the star operator (exclusive)
            const endStarIndex = [
              `(i32.add ${startStarIndex.join("\n")} ${numStarElements.join("\n")})`,
            ];

            const sourceList = [value];
            const incrementOffset = [
              ...offset,
              `(i32.mul ${numStarElements.join("\n")} (i32.const 4))`,
              `(i32.add)`,
              `(local.set $$destructListOffset)`,
            ];
            let copyListSlice: string[] = [
              ...startStarIndex,
              ...endStarIndex,
              ...sourceList,
              ...codeGenListCopy(ListCopyMode.Slice),
            ];

            return codeGenAssignable(assignable, copyListSlice, env).concat(incrementOffset);
          } else {
            const fieldValue = [`(i32.load (i32.add ${value} ${offset}))`];
            const incrementOffset = [
              ...offset,
              `(i32.const 4)`,
              `(i32.add)`,
              `(local.set $$destructListOffset)`,
            ];
            return codeGenAssignable(assignable, fieldValue, env).concat(incrementOffset);
          }
        });
        assignStmts = [...lengthCheck, ...initalizeOffset, ...targetStmts];
        break;
      }
    }
  } else {
    const target = destruct.targets[0];
    assignStmts = codeGenAssignable(target.target, [value], env);
  }

  return assignStmts;
}

function codeGenAssignable(
  target: Assignable<[Type, Location]>,
  value: string[],
  env: GlobalEnv
): string[] {
  // NOTE(alex:mm): temp guards are generated at the statement level
  switch (target.tag) {
    case "id": // Variables
      if (env.locals.has(target.name)) {
        const localIndex = env.locals.get(target.name);
        const result = [...value, `(local.set $${target.name})`];

        return result;
      } else {
        const locationToStore = [`(i32.const ${envLookup(env, target.name)}) ;; ${target.name}`];
        return [...locationToStore, ...value, "(i32.store)"];
      }
    case "lookup": // Field lookup
      var objStmts = codeGenExpr(target.obj, env);
      const objTyp = target.obj.a[0];
      if (objTyp.tag !== "class") {
        // I don't think this error can happen
        throw new BaseException.InternalException(
          "Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag
        );
      }
      var checkNone = codeGenRuntimeCheck(target.obj.a[1], objStmts, RunTime.CHECK_NONE_CLASS);
      objStmts = objStmts.concat(checkNone);
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
          var objStmts = codeGenExpr(target.obj, env);
          var checkNone = codeGenRuntimeCheck(target.obj.a[1], objStmts, RunTime.CHECK_NONE_LOOKUP);
          objStmts = objStmts.concat(checkNone);
          return objStmts.concat(codeGenDictKeyVal(target.key, value, 10, env));
        case "list":
          const listObjStmts = codeGenExpr(target.obj, env);
          const listKeyStmts = codeGenExpr(target.key, env);
          //Add base + (3*4) + (key*4)
          //TODO key is bigNum handling
          const listLocationToStore = [
            ...listObjStmts,
            `(i32.add (i32.const 12)) ;; move past type, size, bound`,
            ...listKeyStmts,
            ...decodeLiteral,
            `(i32.mul (i32.const 4)) `,
            `(i32.add)`,
          ];
          return [...listLocationToStore, ...value, "(i32.store)"];
        default:
          throw new BaseException.InternalException(
            "Bracket-assign for types other than dict not implemented"
          );
      }
    default:
      // Force type error if assignable is added without implementation
      // At the very least, there should be a stub
      const err: never = target;
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

// NOTE(alex:mm): Assuming this is only called for closure allocation
//   which uses a class-based layout
function myMemAlloc(name: string, sizeInValueCount: number, closure?: boolean): Array<string> {
  const allocs: Array<string> = [];
  const sizeInBytes = sizeInValueCount * 4;
  let tag = closure ? TAG_CLOSURE : TAG_REF;
  allocs.push(
    `(i32.const ${Number(closure ? TAG_CLOSURE : TAG_REF)}) ;; heap-tag: ${
      closure ? "closure" : "ref"
    }`
  );
  allocs.push(`(i32.const ${sizeInBytes})`);
  allocs.push(`(call $$gcalloc)`);
  allocs.push(`(local.set ${name}) ;; allocate memory for ${name}`);
  return allocs;
}

function initNested(nested: Array<string>, env: GlobalEnv): Array<string> {
  // this is where the closures are constructed, except for global closures
  // the accesses of callable variables does not create a closure
  const inits: Array<string> = [];

  nested.forEach((fun) => {
    inits.push(...myMemAlloc(`$${fun}_$ref`, 1));
  });

  nested.forEach((fun) => {
    let [idx, nonlocals] = env.funs.get(fun);
    // NOTE(alex:mm): Pass `true` to allocate with TAG_CLOSURE
    inits.push(...myMemAlloc(`$$addr`, nonlocals.length + 1, true));
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
    inits.push(...myMemAlloc(`$${name}_$ref`, 1));
    inits.push(`(i32.store (local.get $${name}_$ref) (local.get $${name}))`);
  });

  return inits;
}

function codeGenClosureDef(def: ClosureDef<[Type, Location]>, env: GlobalEnv): Array<string> {
  let currentLocalIndex = 0;
  const definedVars: Set<string> = new Set();
  definedVars.add("$allocPointer"); // Used to cache the result of `gcalloc`
  definedVars.add("$last");
  definedVars.add("$addr");
  definedVars.add("$destruct");
  definedVars.add("$destructListOffset");
  definedVars.add("$string_val"); //needed for string operations
  definedVars.add("$string_class"); //needed for strings in class
  definedVars.add("$string_index"); //needed for string index check out of bounds
  definedVars.add("$string_address"); //needed for string indexing
  definedVars.add("$slice_start"); //needed for string slicing
  definedVars.add("$slice_end"); //needed for string slicing
  definedVars.add("$slice_stride"); //needed for string slicing
  definedVars.add("$counter"); //needed for string slicing
  definedVars.add("$length"); //needed for string slicing
  def.nonlocals.forEach((v) => definedVars.add(`${v}_$ref`)); // nonlocals are reference, ending with '_$ref'
  def.nested.forEach((f) => definedVars.add(`${f}_$ref`)); // nested functions are references of function ptrs, ending with _$ref
  // ToDo, optimize after EA
  def.inits.forEach((v) => definedVars.add(`${v.name}`));
  def.inits.forEach((v) => definedVars.add(`${v.name}_$ref`));
  def.parameters.forEach((p) => definedVars.add(`${p.name}_$ref`));

  // references that required memory allocation
  const extraRefs: Set<string> = new Set();
  def.inits.forEach((v) => extraRefs.add(`${v.name}`));
  def.parameters.forEach((p) => {
    extraRefs.add(`${p.name}`);
    env.locals.set(p.name, currentLocalIndex);
    currentLocalIndex += 1;
  });

  definedVars.forEach((v) => {
    env.locals.set(v, currentLocalIndex);
    currentLocalIndex += 1;
  });

  const locals = makeLocals(definedVars);
  const inits = def.inits.map((init) => codeGenInit(init, env)).flat();
  const refs = initRef(extraRefs);
  const nonlocals = initNonlocals(def.nonlocals);
  const nested = initNested(def.nested, env);

  let params = def.parameters.map((p) => `(param $${p.name} i32)`).join(" ");
  let stmts = def.body.map((stmt) => codeGenStmt(stmt, env)).flat();

  let body = locals
    .concat(inits)
    .concat(refs)
    .concat(nonlocals)
    .concat(nested)
    .concat(stmts)
    .concat(["(i32.const 0)", "(return)"]);

  const localMap = env.locals;
  const augmentedBody = augmentFnGc(body, localMap, {
    main: false,
    debug: {
      name: def.name,
    },
  });
  const augmentedBodyStr = augmentedBody.join("\n");
  env.locals.clear();

  return [
    `(func $${def.name} (param ${fPTR} i32) ${params} (result i32)
      ${augmentedBodyStr}
    )`,
  ];
}

function codeGenFunDef(def: FunDef<[Type, Location]>, env: GlobalEnv): Array<string> {
  var definedVars: Set<string> = new Set();
  def.inits.forEach((v) => definedVars.add(v.name));
  definedVars.add("$last");
  // Used to cache the result of `gcalloc` and dump
  //   it to the stack for initialization
  // NOTE(alex:mm): need to `local.get` object pointer BEFORE generating code
  //   for inner expressions
  definedVars.add("$allocPointer"); // Used to cache the result of `gcalloc`
  definedVars.add("$destruct");
  definedVars.add("$destructListOffset");
  definedVars.add("$string_val"); //needed for string operations
  definedVars.add("$string_class"); //needed for strings in class
  definedVars.add("$string_index"); //needed for string index check out of bounds
  definedVars.add("$string_address"); //needed for string indexing
  definedVars.add("$slice_start"); //needed for string slicing
  definedVars.add("$slice_end"); //needed for string slicing
  definedVars.add("$slice_stride"); //needed for string slicing
  definedVars.add("$counter"); //needed for string slicing
  definedVars.add("$length"); //needed for string slicing

  // NOTE(alex:mm): parameters indices go first
  let currLocalIndex = 0;
  var params = def.parameters
    .map((p) => {
      env.locals.set(p.name, currLocalIndex);
      currLocalIndex += 1;
      return `(param $${p.name} i32)`;
    })
    .join(" ");

  definedVars.forEach((v) => {
    env.locals.set(v, currLocalIndex);
    currLocalIndex += 1;
  });

  const locals = makeLocals(definedVars);
  const inits = def.inits.map((init) => codeGenInit(init, env)).flat();
  var stmts = def.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();

  const body = locals.concat(inits).concat(stmts).concat(["(i32.const 0)", "(return)"]);
  const localMap = env.locals;
  const augmentedBody = augmentFnGc(body, localMap, {
    main: false,
    debug: {
      name: def.name,
    },
  });
  const augmentedBodyStr = augmentedBody.join("\n");
  env.locals.clear();

  return [
    `(func $${def.name} ${params} (result i32)
    ${augmentedBodyStr}
    )`,
  ];
}

function codeGenClass(cls: Class<[Type, Location]>, env: GlobalEnv): Array<string> {
  const methods = [...cls.methods];
  methods.forEach((method) => (method.name = `${cls.name}$${method.name}`));
  const result = methods.map((method) => codeGenFunDef(method, env));
  return result.flat();
}

function codeGenListCopy(mode: ListCopyMode): Array<string> {
  var stmts: Array<string> = [];
  var loopstmts: Array<string> = [];
  var condstmts: Array<string> = [];
  var concatstmts: Array<string> = [];
  var doublestmts: Array<string> = [];
  var tempstmts: Array<string> = [];
  var listType = 10; //temporary list type number
  var header = [4, 8]; //size, bound relative position
  var cmp = [""];

  stmts.push(
    ...[
      `(local.tee $$list_cmp)`, //store first address to local var
      `(i32.add (i32.const 8))`,
      `(i32.load)`,
      `(local.set $$list_temp)`, //capacity
      `(i32.const 0)`,
      `(local.set $$list_index2)`, //second index
    ]
  );

  if (mode === ListCopyMode.Slice) {
    stmts.push(
      ...[
        `(local.set $$list_bound)`, // max index(not include)
        `(local.set $$list_index)`, // current index
        `(local.get $$list_bound)`,
        `(local.get $$list_index)`,
        `(i32.sub)`,
        `(local.set $$list_size)`,
      ] //size of list
    );
  } else {
    stmts.push(
      ...[
        `(local.get $$list_cmp)`,
        `(i32.add (i32.const 4))`,
        `(i32.load)`,
        `(local.tee $$list_size)`, //capacity
        `(local.set $$list_bound)`,
        `(i32.const 0)`,
        `(local.set $$list_index)`,
      ]
    );
  }

  if (mode === ListCopyMode.Concat) {
    cmp = ["", "2"];
    stmts.push(
      ...[
        `(local.tee $$list_cmp2)`,
        `(i32.add (i32.const 8))`,
        `(i32.load)`,
        `(local.get $$list_temp)`,
        `(i32.add)`,
        `(local.set $$list_temp)`, //capacity
        `(local.get $$list_cmp2)`,
        `(i32.add (i32.const 4))`,
        `(i32.load)`,
        `(local.get $$list_size)`,
        `(i32.add)`,
        `(local.set $$list_size)`, //size
      ]
    );
  }

  if (mode === ListCopyMode.Double) {
    stmts.push(
      ...[
        `(local.get $$list_temp)`,
        `(i32.mul (i32.const 2))`,
        `(local.set $$list_temp)`, //capacity
      ]
    );
  }

  stmts.push(
    ...[
      `(i32.const ${TAG_LIST})    ;; heap-tag: list`,
      `(local.get $$list_temp)`, // load capacty
      `(i32.add (i32.const 3))`,
      `(i32.mul (i32.const 4))`,
      `(call $$gcalloc)`,
      `(local.set $$list_base)`,
    ]
  );

  //add/modify header info of the list
  header.forEach((addr) => {
    var varname = `list_${addr === 4 ? "size" : "temp"}`;
    stmts.push(
      ...[
        `(local.get $$list_base)`,
        `(i32.add (i32.const ${addr}))`,
        `(local.get $$${varname})`,
        `(i32.store)`,
      ]
    );
  });

  stmts.push(...[`(local.get $$list_base)`, "(i32.const " + listType + ")", "(i32.store)"]); //create a new list with type

  //check if the current index has reached the size of the list
  condstmts.push(...[`(local.get $$list_bound)`, `(local.get $$list_index)`, `(i32.eq)`]);

  //statement for loop through the compared list and add the elements to the new list
  loopstmts.push(
    ...[
      `(local.get $$list_base)`,
      `(i32.add (i32.const 12))`,
      `(local.get $$list_index2)`,
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
      `(local.get $$list_index2)`,
      `(i32.add (i32.const 1))`,
      `(local.set $$list_index2)`,
    ]
  );

  cmp.forEach((s) => {
    if (s !== ``) {
      stmts.push(
        ...[
          `(local.get $$list_cmp2)`,
          `(local.set $$list_cmp)`,
          `(i32.const 0)`,
          `(local.set $$list_index)`,
          `(local.get $$list_cmp)`,
          `(i32.add (i32.const 4))`,
          `(i32.load)`,
          `(i32.add (local.get $$list_bound))`,
          `(local.set $$list_bound)`,
        ]
      );
    }

    //while loop structure
    stmts.push(
      ...[`(block`, `(loop`, `(br_if 1`, ...condstmts, `)`, ...loopstmts, `(br 0)`, `)`, `)`]
    );
  });

  return stmts.concat([
    `(local.get $$list_base)`, // Get address for the object (this is the return value)
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
        //print_list takes an additional arg: type of elements in list
        //print_list(base_addr, elem_type)
      } else if (expr.name === "print" && argTyp.tag === "list") {
        return argStmts.concat([codeGenListElemType(argTyp.content_type), `(call $print_list)`]);
      } else if (expr.name === "print" && argTyp === BOOL) {
        return argStmts.concat([`(call $print_bool)`]);
      } else if (expr.name === "print" && argTyp === NONE) {
        return argStmts.concat([`(call $print_none)`]);
      } else if (expr.name === "len") {
        return argStmts.concat([`(i32.load)(i32.add(i32.const 1))`, ...encodeLiteral]);
      }
      return argStmts.concat(codeGenCall(expr.a[1], `(call $${callName})`));
    case "builtin2":
      const leftStmts = codeGenExpr(expr.left, env);
      const rightStmts = codeGenExpr(expr.right, env);
      return [...leftStmts, ...rightStmts, `(call $${expr.name})`];
    // =======
    //       we will need to check with the built-in functions team to determine how BigNumbers will interface with the built-in functions
    //       return [
    //         ...leftStmts,
    //         ...decodeLiteral,
    //         ...rightStmts,
    //         ...decodeLiteral,
    //         ...codeGenCall(expr.a[1], `(call $${expr.name})`),
    //         ...encodeLiteral,
    //       ];
    // >>>>>>> main
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
        return [...rhsStmts, ...lhsStmts, ...codeGenListCopy(ListCopyMode.Concat)];
      } else if (expr.op == BinOp.Plus && expr.left.a[0].tag === "string") {
        return [...lhsStmts, ...rhsStmts, `(call $str$concat)`];
      } else if (expr.op == BinOp.Mul && expr.left.a[0].tag === "string") {
        return [...lhsStmts, ...rhsStmts, ...decodeLiteral, `(call $str$multiply)`];
      } else if (expr.op == BinOp.Eq && expr.left.a[0].tag === "string") {
        return [...lhsStmts, ...rhsStmts, `(call $str$equals)`, ...encodeLiteral];
      } else if (expr.op == BinOp.Neq && expr.left.a[0].tag === "string") {
        return [...lhsStmts, ...rhsStmts, `(call $str$equals)`, `(i32.eqz)`, ...encodeLiteral];
      } else if (expr.op == BinOp.Gt && expr.left.a[0].tag === "string") {
        return [...lhsStmts, ...rhsStmts, `(call $str$greater)`, ...encodeLiteral];
      } else if (expr.op == BinOp.Gte && expr.left.a[0].tag === "string") {
        return [...lhsStmts, ...rhsStmts, `(call $str$greaterEq)`, ...encodeLiteral];
      } else if (expr.op == BinOp.Lt && expr.left.a[0].tag === "string") {
        return [...lhsStmts, ...rhsStmts, `(call $str$greaterEq)`, `(i32.eqz)`, ...encodeLiteral];
      } else if (expr.op == BinOp.Lte && expr.left.a[0].tag === "string") {
        return [...lhsStmts, ...rhsStmts, `(call $str$greater)`, `(i32.eqz)`, ...encodeLiteral];
      } else if (expr.op == BinOp.Is) {
        return [...lhsStmts, ...rhsStmts, codeGenBinOp(expr.op), ...encodeLiteral];
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
        return [
          ...lhsStmts,
          ...rhsStmts,
          ...(expr.op == BinOp.IDiv
            ? codeGenRuntimeCheck(
                expr.a[1],
                [...rhsStmts, ...decodeLiteral],
                RunTime.CHECK_ZERO_DIVISION
              )
            : [""]),
          codeGenBinOp(expr.op),
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
      break;
    case "call":
      var prefix = "";
      if (expr.name === "dict") {
        //dict constructor call
        return codeGenExpr(expr.arguments[0], env); //call code gen for the dict argument
      }
      if (expr.name === "range") {
        // TODO - error-reporting: stacktrace for range
        switch (expr.arguments.length) {
          case 1:
            var valStmts = [`(i32.const 1)`];
            valStmts = valStmts.concat(expr.arguments.map((arg) => codeGenExpr(arg, env)).flat());
            valStmts.push(`(i32.const 3)`);
            valStmts.push(`(call $${expr.name})`);
            return valStmts;
          case 2:
            var valStmts = [`(i32.const 1)`];
            valStmts = valStmts.concat(expr.arguments.map((arg) => codeGenExpr(arg, env)).flat());
            valStmts.push(`(call $${expr.name})`);
            return valStmts;
          case 3:
            var valStmts = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
            valStmts.push(`(call $${expr.name})`);
            return valStmts;
          default:
            throw new BaseException.InternalException("Unsupported range() call!");
        }
      } else if (expr.name === "len") {
        if (expr.arguments[0].a[0].tag === "list") {
          prefix = "$$list";
        } else {
          throw new Error("Unimplemented len() for " + expr.arguments[0].a[0].tag);
        }
      }
      var valStmts = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
      valStmts = valStmts.concat(codeGenCall(expr.a[1], `(call ${prefix}$${expr.name})`));
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
          callExpr.push(...codeGenExpr(arg, env));
        });

        // NOTE(alex:mm): necessary in order to root the return value
        callExpr.push(
          ...codeGenCall(
            expr.a[1],
            `(call_indirect (type $callType${
              expr.arguments.length + 1
            }) (i32.load (i32.load (i32.const ${envLookup(env, funName)}))))`
          )
        );
      } else if (nameExpr.tag == "lookup") {
        funName = (nameExpr.obj as any).name;
        callExpr.push(`(i32.load (local.get $${funName})) ;; argument for $fPTR`);
        expr.arguments.forEach((arg) => {
          callExpr.push(...codeGenExpr(arg, env));
        });
        // NOTE(alex:mm): necessary in order to root the return value
        callExpr.push(
          ...codeGenCall(
            expr.a[1],
            `(call_indirect (type $callType${
              expr.arguments.length + 1
            }) (i32.load (i32.load (local.get $${funName}))))`
          )
        );
      } else if (nameExpr.tag == "call_expr") {
        callExpr.push(...codeGenExpr(nameExpr, env));
        callExpr.push(`(local.set $$addr)`);
        callExpr.push(`(local.get $$addr) ;; function ptr for the extra argument`);
        expr.arguments.forEach((arg) => {
          callExpr.push(...codeGenExpr(arg, env));
        });
        callExpr.push(
          ...codeGenCall(
            expr.a[1],
            `(call_indirect (type $callType${
              expr.arguments.length + 1
            }) (i32.load (local.get $$addr)))`
          )
        );
      } else {
        throw new BaseException.InternalException(`Invalid name of tag ${nameExpr.tag}`);
      }
      return callExpr;
    case "construct":
      let allocSize = env.classes.get(expr.name).size * 4;
      let heapTag = TAG_CLASS;
      // TODO(alex:mm): figure out what do with ZSTs
      // NOTE(alex:mm): calling `gcalloc` with size 0 is an error
      // Either somehow do something with ZSTs or just allocate a placeholder
      if (allocSize === 0) {
        allocSize = 4;
        heapTag = TAG_OPAQUE;
      }
      var stmts: Array<string> = [
        `(i32.const ${Number(heapTag)})   ;; heap-tag: class`,
        `(i32.const ${allocSize})   ;; size in bytes`,
        `(call $$gcalloc)`,
        `(local.set $$allocPointer)`,
        `(local.get $$allocPointer)`, // return to parent expr
        `(local.get $$allocPointer)`, // use in __init__
      ];
      // NOTE(alex): hack to get nested allocations to work
      // Let F by the number of fields in the class
      // Dump the pointer F + 2 times on the stack
      //   * +1 in order to call the __init__ method
      //   * +1 in order to return the leave the pointer at the top of the stack
      const classLayout = env.classes.get(expr.name);
      classLayout.forEach(() => {
        stmts.push(`(local.get $$allocPointer)`);
      });
      classLayout.forEach(([offset, initVal], field) =>
        stmts.push(
          ...[
            // Pointer should be on the top of the stack already
            `(i32.add (i32.const ${offset * 4}))`, // Calc field offset from heap offset
            ...codeGenLiteral(initVal), // Initialize field
            `(i32.store) ;; store for ${field}`, // Put the default field value on the heap
          ]
        )
      );
      return stmts.concat([
        // Pointer to deref should be on the top of the stack already
        ...codeGenCall(expr.a[1], `(call $${expr.name}$__init__)`), // call __init__
        `(drop)`, // Drop None from __init__
        // Pointer to return should be on the top of the stack already
      ]);
    case "method-call":
      var objType = expr.obj.a[0];
      //Object method calls
      if (objType.tag === "class") {
        let clsName = objType.name;
        let argsExprs = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
        //Handle object indrect function calls
        if (env.classes.get(clsName).has(expr.method)) {
          let callExpr: Array<string> = [];
          callExpr.push(...codeGenExpr(expr.obj, env));
          callExpr.push(
            `(i32.add (i32.const ${env.classes.get(clsName).get(expr.method)[0] * 4}))`
          );
          callExpr.push(`(i32.load) ;; load the function pointer for the extra argument`);
          callExpr.push(...argsExprs);
          callExpr.push(...codeGenExpr(expr.obj, env));
          callExpr.push(
            `(i32.add (i32.const ${env.classes.get(clsName).get(expr.method)[0] * 4}))`
          );
          callExpr.push(`(i32.load) ;; load the function pointer`);
          callExpr.push(`(i32.load) ;; load the function index`);
          callExpr.push(
            ...codeGenCall(
              expr.a[1],
              `(call_indirect (type $callType${expr.arguments.length + 1}))`
            )
          );
          return callExpr;
        } else {
          //Regular class object calls
          return [...codeGenExpr(expr.obj, env), ...argsExprs, `(call $${clsName}$${expr.method})`];
        }
        //Dict method calls
      } else if (objType.tag === "dict") {
        return codeGenDictMethods(expr.obj, expr.method, expr.arguments, env);
      } else if (objType.tag === "list") {
        var objStmts = codeGenExpr(expr.obj, env);
        className = "$list";
        var extStmts: Array<string> = [];
        var objExpr = expr.obj;
        if (expr.method === "append") {
          switch (objExpr.tag) {
            case "id":
              if (env.locals.has(objExpr.name)) {
                extStmts = [
                  `(local.tee $$list_temp)`,
                  `(local.set $${objExpr.name})`,
                  `(local.get $$list_temp)`,
                ];
              } else {
                const locationToStore = [
                  `(i32.const ${envLookup(env, objExpr.name)}) ;; ${objExpr.name}`,
                ];
                extStmts = [
                  `(local.set $$list_temp)`,
                  ...locationToStore,
                  `(local.get $$list_temp)`,
                  "(i32.store)",
                  `(local.get $$list_temp)`,
                ];
              }
              break;
          }
        }
        var argsStmts = expr.arguments
          .map((arg) => codeGenExpr(arg, env))
          .flat()
          .concat();

        return [
          ...objStmts,
          ...argsStmts,
          ...codeGenCall(expr.a[1], `(call $${className}$${expr.method})`),
          ...extStmts,
        ];
      } else {
        // I don't think this error can happen
        throw new BaseException.InternalException(
          "Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag
        );
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
      var checkNone = codeGenRuntimeCheck(expr.a[1], objStmts, RunTime.CHECK_NONE_CLASS);
      objStmts = objStmts.concat(checkNone);
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

      // NOTE(alex:mm) $$allocPointer clobbered by recurse codegen
      //   Should be fine in this context
      stmts.push(
        ...[
          `(i32.const ${TAG_LIST}) ;; heap-tag: list`,
          `(i32.const ${(listBound + 3) * 4})`,
          `(call $$gcalloc)`,
          `(local.set $$allocPointer)`,
        ]
      );

      listHeader.forEach((val) => {
        stmts.push(
          ...[
            `(local.get $$allocPointer)`,
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
            `(local.get $$allocPointer)`,
            `(i32.add (i32.const ${listindex * 4}))`,
            `(local.get $$list_temp)`,
            "(i32.store)",
          ]
        );
        listindex += 1;
      });
      //Move heap head to the end of the list and return list address
      return stmts.concat([`(local.get $$allocPointer)`]);
    case "tuple-expr":
      return codeGenTupleAlloc(expr, env);
    case "bracket-lookup":
      switch (expr.obj.a[0].tag) {
        case "dict":
          return codeGenDictBracketLookup(expr.obj, expr.key, 10, env);
        case "string":
          var brObjStmts = codeGenExpr(expr.obj, env);
          var brKeyStmts = codeGenExpr(expr.key, env);
          return [...brObjStmts, ...brKeyStmts, ...decodeLiteral, `(call $str$index)`];
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
            codeGenRuntimeCheck(expr.a[1], objStmts, RunTime.CHECK_NONE_LOOKUP),
            codeGenRuntimeCheck(
              expr.a[1],
              [...objStmts, `(i32.add (i32.const 4))`, `(i32.load)`, ...keyStmts, ...decodeLiteral],
              RunTime.CHECK_INDEX_ERROR
            ),
            keyStmts,
            [
              ...decodeLiteral,
              `(i32.mul (i32.const 4))`,
              `(i32.add (i32.const 12)) ;; move past type, size, bound`,
              `(i32.add) ;; retrieve element location`,
              `(i32.load) ;; load list element`,
            ]
          );
        case "tuple": {
          return [
            // Get tuple address
            ...codeGenExpr(expr.obj, env),
            // Get word offset from tuple address
            ...codeGenExpr(expr.key, env),
            ...decodeLiteral,
            // Get byte offset
            "(i32.mul (i32.const 4))",
            // Calculate target address
            "(i32.add)",
            // Load target value
            "(i32.load)",
          ];
        }
        default:
          throw new BaseException.InternalException(
            "Code gen for bracket-lookup for types other than dict not implemented"
          );
      }
    case "slicing":
      switch (expr.name.a[0].tag) {
        case "string":
          // name, start, end, stride
          var nameStmts = codeGenExpr(expr.name, env);
          var startStmts = null;
          var endStmts = null;
          if (expr.end !== null) {
            endStmts = codeGenExpr(expr.end, env);
          }
          if (expr.start !== null) {
            startStmts = codeGenExpr(expr.start, env);
          }
          var strideStmts = codeGenExpr(expr.stride, env);
          var sliceStmts = [];
          sliceStmts.push(
            ...[
              ...nameStmts,
              `(local.set $$string_address)`,
              ...strideStmts,
              ...decodeLiteral,
              `(local.set $$slice_stride)`,
              `(i32.eq(local.get $$slice_stride)(i32.const 0))`,
              `(if (then (i32.const -2)(call $print_str)(drop)))`, //Check if stride value is 0
            ]
          );
          if (startStmts === null) {
            sliceStmts.push(
              ...[
                `(local.get $$slice_stride)`, //if there is no start value: if stride is -ve, start = length, else start = 0
                `(i32.const 0)(i32.lt_s)`,
                `(if (then (local.get $$string_address)(i32.load)(local.set $$slice_start) )(else`,
                `(i32.const 0)`, //get the string length
                `(local.set $$slice_start)`,
                `))`, //close if
              ]
            );
          } else {
            sliceStmts.push(
              ...[
                ...startStmts,
                ...decodeLiteral,
                `(local.set $$slice_start)`,
                `(local.get $$slice_start)`,
                `(i32.const 0)(i32.lt_s)`, //check for negative start index
                `(if (then (local.get $$string_address)(i32.load)(i32.add (i32.const 1))(local.get $$slice_start)(i32.add)(local.set $$slice_start)))`, //if -ve, we do length + index
              ]
            );
          }
          if (endStmts === null) {
            sliceStmts.push(
              ...[
                `(local.get $$slice_stride)`,
                `(i32.const 0)(i32.lt_s)`,
                `(if (then (i32.const -1) (local.set $$slice_end) )(else`,
                `(local.get $$string_address)(i32.load)(i32.add(i32.const 1))`, //get the string length
                `(local.set $$slice_end)`,
                `))`, //close if
              ]
            );
          } else {
            sliceStmts.push(
              ...[
                ...endStmts,
                ...decodeLiteral,
                `(local.set $$slice_end)`,
                `(local.get $$slice_end)`,
                `(i32.const 0)(i32.lt_s)`, //check for negative end index
                `(if (then (local.get $$string_address)(i32.load)(i32.add (i32.const 1))(local.get $$slice_end)(i32.add)(local.set $$slice_end)))`, //if -ve, we do length + index
              ]
            );
          }
          sliceStmts.push(
            ...[
              `(local.get $$slice_stride)`,
              `(i32.const 0)(i32.ge_s)`, //check for negative end index
              `(if (result i32)(then `,
              `(i32.gt_s(local.get $$slice_end)(local.get $$string_address)(i32.load)(i32.add(i32.const 1)))`,
              `(if (then (local.get $$string_address)(i32.load)(i32.add(i32.const 1))(local.set $$slice_end) ))`,
              `(i32.lt_s(local.get $$slice_start)(local.get $$slice_end))`,
              `)`, //end then
              `(else`,
              `(i32.gt_s(local.get $$slice_start)(local.get $$string_address)(i32.load))`,
              `(if (then (local.get $$string_address)(i32.load)(local.set $$slice_start) ))`,
              `(i32.lt_s(local.get $$slice_end)(local.get $$slice_start))`,
              `)`, //end else
              `)`, //end if
              `(i32.eq (i32.const 0))`,
              `(if (result i32)(then `, //if
              `(i32.const ${TAG_STRING})`,
              `(i32.const 4)`,
              `(call $$gcalloc)`,
              `(local.tee $$allocPointer)`,
              `(i32.const -1)`, //length for empty string
              `(i32.store)`,
              `(local.get $$allocPointer)`,
              `)`, //close then
              `(else`,
            ]
          );
          sliceStmts.push(
            ...[
              // `(i32.rem_s(i32.sub(local.get $$slice_end)(local.get $$slice_start))(call $abs)(local.get $$slice_stride)(call $abs))`,
              // `(i32.div_s(i32.sub(local.get $$slice_end)(local.get $$slice_start))(call $abs)(local.get $$slice_stride)(call $abs))`,//find length = end - start
              // `(i32.add)`,
              // `(local.set $$length)`,//set length local
              `(i32.sub(local.get $$slice_end)(local.get $$slice_start))`,
              `(local.set $$counter)`, //using counter as a temp variable for abs calculation
              `(local.get $$slice_stride)`,
              `(local.set $$string_class)`, //using string_class as a temp variable for abs calculation
              //doing abs manually since (call $abs) doesn't work
              `(i32.lt_s (local.get $$counter) (i32.const 0))`,
              `(if (then (i32.sub (i32.const 0)(local.get $$counter)) (local.set $$counter) ))`,
              `(i32.lt_s (local.get $$string_class) (i32.const 0))`,
              `(if (then (i32.sub (i32.const 0)(local.get $$string_class)) (local.set $$string_class) ))`,
              //get the length of the new sliced string
              `(i32.rem_s (local.get $$counter) (local.get $$string_class))`,
              `(i32.div_s (local.get $$counter) (local.get $$string_class))`,
              `(i32.add)`,
              `(local.set $$length)`,
              //allocate memory for the new sliced string
              `(i32.const ${TAG_STRING})`,
              `(i32.mul (i32.add (local.get $$length) (i32.const 1))(i32.const 4) )`,
              `(i32.mul (i32.const 4))`,
              `(call $$gcalloc)`,
              `(local.tee $$allocPointer)`,
              `(i32.sub (local.get $$length) (i32.const 1))`, //length for new string
              `(i32.store)`,
              `(local.get $$allocPointer)`,
              `(i32.add (i32.const 4))`,
              `(local.set $$string_index)`,
              //loop through sliced string character to copy into a new string
              `(block (loop (br_if 1`,
              `(local.get $$slice_stride)`,
              `(i32.const 0)(i32.ge_s)`,
              `(if (result i32) (then (i32.lt_s(local.get $$slice_start)(local.get $$slice_end)))(else`,
              `(i32.gt_s(local.get $$slice_start)(local.get $$slice_end))`, //get the string length
              `))`, //close if
              `(i32.eqz))`, //while loop condition
              `(local.get $$string_address)`,
              `(i32.add (i32.mul (i32.const 4)(local.get $$slice_start)))`, //Add the index * 4 value to the address
              `(i32.add (i32.const 4))`, //Adding 4 since string length is at first index
              `(i32.load)`, //Load the ASCII value of the string index
              `(local.set $$string_val)`,
              `(local.get $$string_index)`,
              `(local.get $$string_val)`,
              `(i32.store)`, //Store the ASCII value in the new address
              `(i32.add(local.get $$string_index)(i32.const 4))(local.set $$string_index)`,
              `(local.get $$slice_start)(i32.add(local.get $$slice_stride))(local.set $$slice_start)`,
              `(br 0) ))`, // while loop end
            ]
          );
          sliceStmts.push(
            ...[
              `(local.get $$allocPointer)`,
              `))`, //close else and if
            ]
          );
          return sliceStmts;
        default:
          throw new Error("Code gen for slicing not implemented");
      }
    default:
      unhandledTag(expr);
  }
}

function codeGenTupleAlloc(
  expr: WithTag<Expr<[Type, Location]>, "tuple-expr">,
  env: GlobalEnv
): string[] {
  let stmts = [
    `(i32.const ${Number(TAG_TUPLE)})   ;; heap-tag: tuple`,
    `(i32.const ${expr.contents.length * 4})   ;; size in bytes`,
    `(call $$gcalloc)`,
    `(local.set $$allocPointer)`,
  ];
  // Adopting the object hack of pushing one copy of $$allocPointer onto the stack for every item in the tuple.
  // The best solution would be to reset allocPointer to its original value after creating the new stack
  // object, but it's probably too late to institute a change like that.
  stmts.push("(local.get $$allocPointer)\n".repeat(expr.contents.length + 1));
  expr.contents.forEach((content, offset) => {
    stmts.push(...codeGenExpr(content, env), `(i32.store offset=${offset * 4})`);
  });
  return stmts;
}

function codeGenDictMethods(
  obj: Expr<[Type, Location]>,
  method: string,
  args: Array<Expr<[Type, Location]>>,
  env: GlobalEnv
): Array<string> {
  let dictMethodStmts: Array<string> = [];
  var objStmts = codeGenExpr(obj, env);
  switch (method) {
    case "get":
      var argsStmts = args.map((arg) => codeGenExpr(arg, env)).flat();
      return [...objStmts, ...argsStmts, `(call $dict$get)`];
    case "update":
      if (args[0].tag === "dict") {
        let dictStmts: Array<string> = [];
        let dictAddress: Array<string> = [];
        args[0].entries.forEach((keyval) => {
          dictAddress = dictAddress.concat(...objStmts); //pushing the dict base address for each key-value pair update call
          const value = codeGenExpr(keyval[1], env);
          dictStmts = dictStmts.concat(codeGenDictKeyVal(keyval[0], value, 10, env));
        });
        return [...dictAddress, ...dictStmts, "(i32.const 0)"]; //last parameter to indicate none is being returned by this function
      } else {
        throw new BaseException.InternalException(
          "Update doesn't support any other type of arguments other than a dict"
        );
      }
    case "pop":
    case "clear":
      var argsStmts = args.map((arg) => codeGenExpr(arg, env)).flat();
      return [...objStmts, ...argsStmts, `(call $dict$${method})`];
    default:
      throw new BaseException.InternalException("Unsupported dict method call");
  }
}

function codeGenDictAlloc(hashtableSize: number, env: GlobalEnv, entries: number): Array<string> {
  // NOTE(alex:mm): $$allocPointer is clobbered by inner exprs
  // Dump it to the stack before you codegen for inner exprs
  let dictAllocStmts: Array<string> = [];
  dictAllocStmts = dictAllocStmts.concat([
    `(i32.const ${Number(TAG_DICT)})   ;; heap-tag: dictionary`,
    `(i32.const ${hashtableSize * 4})   ;; size in bytes`,
    `(call $$gcalloc)`,
    `(local.set $$allocPointer)`,
    `(local.get $$allocPointer)`, // return to parent expr
  ]);

  //Ideally this loop should be replaced by call to allocator API to allocate hashtablesize entries on heap.
  for (let i = 0; i < hashtableSize; i++) {
    dictAllocStmts.push(
      ...[
        `(local.get $$allocPointer)`,
        `(i32.add (i32.const ${i * 4}))`, // Calc hash table entry offset from heap offset
        ...codeGenLiteral({ tag: "none" }), // CodeGen for "none" literal
        "(i32.store)", // Initialize to none
      ]
    );
  }
  //Push the base address of dict on the stack to be consumed by each of the key:val pair initialization
  for (let i = 0; i < entries; i++) {
    dictAllocStmts = dictAllocStmts.concat(["(local.get $$allocPointer)"]);
  }

  // entries + 1 dict pointers should be on the stack
  return dictAllocStmts;
}

function allocateStringMemory(string_val: string): Array<string> {
  const stmts = [];
  var i = 0;
  const ascii_array = [];
  while (i != string_val.length) {
    var char_ascii = string_val.charCodeAt(i);
    if (char_ascii === 92) {
      i += 1;
      if (i == string_val.length) {
        throw new BaseException.InternalException(`Bad escape in ${string_val}`);
      }
      char_ascii = string_val.charCodeAt(i);
      console.log("Character ascii " + char_ascii);
      if (char_ascii == 110) {
        char_ascii = 10;
      } else if (char_ascii == 116) {
        char_ascii = 9;
      } else if (char_ascii != 92 && char_ascii != 34) {
        throw new BaseException.InternalException(`Bad escape in ${string_val}`);
      }
    }
    ascii_array.push(char_ascii);
    i += 1;
  }
  //Storing the length of the string at the beginning
  var allocSizeBytes = (ascii_array.length + 1) * 4;
  stmts.push(
    ...[
      `(i32.const ${Number(TAG_STRING)})  ;; heap-tag: string`,
      `(i32.const ${allocSizeBytes})`,
      `(call $$gcalloc)`,
      `(local.tee $$allocPointer)`,
      `(i32.const ${ascii_array.length - 1})`, // Store the length of the string
      "(i32.store)", // Store the ASCII value 0 in the new address
    ]
  );
  ascii_array.forEach(function (char_ascii, i) {
    stmts.push(
      ...[
        `(local.get $$allocPointer)`,
        `(i32.add (i32.const ${(i + 1) * 4}))`, // Calc string index offset from heap offset
        `(i32.const ${char_ascii})`, // Store the ASCII value of the string index
        "(i32.store)", // Store the ASCII value in the new address
      ]
    );
  });
  return stmts.concat([
    `(local.get $$allocPointer)`, // return the allocated pointer
  ]);
}

function codeGenDictBracketLookup(
  obj: Expr<[Type, Location]>,
  key: Expr<[Type, Location]>,
  hashtableSize: number,
  env: GlobalEnv
): Array<string> {
  let dictKeyValStmts: Array<string> = [];
  var objStmts = codeGenExpr(obj, env);
  var checkNone = codeGenRuntimeCheck(obj.a[1], objStmts, RunTime.CHECK_NONE_LOOKUP);
  var checkKey = codeGenRuntimeCheck(
    obj.a[1],
    [
      ...objStmts,
      ...codeGenExpr(key, env),
      `(i32.const ${hashtableSize})`,
      "(call $ha$htable$Lookup)",
    ],
    RunTime.CHECK_KEY_ERROR
  );
  dictKeyValStmts = dictKeyValStmts.concat(objStmts);
  dictKeyValStmts = dictKeyValStmts.concat(checkNone);
  dictKeyValStmts = dictKeyValStmts.concat(checkKey);
  dictKeyValStmts = dictKeyValStmts.concat(codeGenExpr(key, env));
  dictKeyValStmts = dictKeyValStmts.concat([
    `(i32.const ${hashtableSize})`,
    "(call $ha$htable$Lookup)",
  ]);
  return dictKeyValStmts.concat(["(i32.load)"]);
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

function stringUtilFuns(): Array<string> {
  let strFunStmts: Array<string> = [];
  strFunStmts.push(
    ...[
      `(func $str$concat (param $left_addr i32) (param $right_addr i32) (result i32)`,
      `(local $counter i32) (local $lhs_len i32) (local $rhs_len i32) (local $updated_addr i32) (local $$allocPointer i32)`,
      `(i32.add (i32.load (local.get $left_addr)) (i32.const 1) )`,
      `(local.set $lhs_len)`,
      `(i32.add (i32.load (local.get $right_addr)) (i32.const 1) )`,
      `(local.set $rhs_len)`,
      `(i32.const 1)(local.set $counter)`,
      `(i32.const ${TAG_STRING})`,
      `(i32.add (i32.add (local.get $lhs_len) (local.get $rhs_len)) (i32.const 1))`, //memory to be allocated
      `(i32.mul (i32.const 4))`,
      `(call $$gcalloc)`,
      `(local.tee $$allocPointer)`,
      `(i32.add (local.get $lhs_len) (local.get $rhs_len) )`, //add length of two strings to be concatenated
      `(i32.sub (i32.const 1))`,
      `(i32.store)`,
      `(block (loop (br_if 1 (i32.le_s (local.get $counter) (local.get $lhs_len) )(i32.eqz) )`,
      `(i32.add (local.get $$allocPointer) (i32.mul (local.get $counter) (i32.const 4) ) )`,
      `(i32.load (i32.add (local.get $left_addr) (i32.mul (local.get $counter) (i32.const 4) ) ))`, //ascii val of left_i
      `(i32.store)`,
      `(i32.add (local.get $counter) (i32.const 1))(local.set $counter)`,
      `(br 0)`,
      `))`, //end block and loop
      `(i32.sub(local.get $counter)(i32.const 1))(local.set $counter)`,
      `(i32.add (local.get $$allocPointer) (i32.mul (local.get $counter) (i32.const 4) ) )`,
      `(local.set $updated_addr)`,
      `(i32.const 1)(local.set $counter)`,
      `(block (loop (br_if 1 (i32.le_s (local.get $counter) (local.get $rhs_len) ) (i32.eqz))`,
      `(i32.add (local.get $updated_addr) (i32.mul (local.get $counter) (i32.const 4) ) )`,
      `(i32.load (i32.add (local.get $right_addr) (i32.mul (local.get $counter) (i32.const 4) ) ))`, //ascii val of left_i
      `(i32.store)`,
      `(i32.add (local.get $counter) (i32.const 1))(local.set $counter)`,
      `(br 0)`,
      `))`, //end block and loop
      `(local.get $$allocPointer)`,
      `)`, //close func
    ]
  );
  strFunStmts.push(
    ...[
      `(func $str$multiply (param $left_addr i32) (param $multiplier i32) (result i32)`,
      `(local $i i32) (local $j i32) (local $lhs_len i32) (local $updated_addr i32) (local $$allocPointer i32)`,
      `(i32.add (i32.load (local.get $left_addr)) (i32.const 1) )`,
      `(local.set $lhs_len)`,
      `(i32.const ${TAG_STRING})`,
      `(i32.add (i32.mul (local.get $lhs_len) (local.get $multiplier)) (i32.const 1))`, //memory to be allocated
      `(i32.mul (i32.const 4))`,
      `(call $$gcalloc)`,
      `(local.tee $$allocPointer)`,
      `(i32.mul (local.get $lhs_len) (local.get $multiplier) )`, //add length of two strings to be concatenated
      `(i32.sub (i32.const 1))`,
      `(i32.store)`,
      `(i32.const 0)(local.set $i)`,
      `(local.get $$allocPointer)`,
      `(local.set $updated_addr)`,
      `(block (loop (br_if 1 (i32.lt_s (local.get $i) (local.get $multiplier) )(i32.eqz) )`,
      `(i32.const 0)(local.set $j)`,
      `(block (loop (br_if 1 (i32.lt_s (local.get $j) (local.get $lhs_len) )(i32.eqz) )`,
      `(i32.add (local.get $updated_addr) (i32.const 4))`, //address for storing the new string
      `(local.set $updated_addr)`,
      `(local.get $updated_addr)`,
      `(i32.load (i32.add (local.get $left_addr) (i32.mul (i32.add (local.get $j) (i32.const 1)) (i32.const 4))))`, //ascii val of left_i
      `(i32.store)`,
      `(i32.add (local.get $j) (i32.const 1))(local.set $j)`,
      `(br 0)`,
      `))`, //end block and loop
      `(i32.add (local.get $i) (i32.const 1))(local.set $i)`,
      `(br 0)`,
      `))`, //end block and loop
      `(local.get $$allocPointer)`,
      `)`, //close func
    ]
  );
  strFunStmts.push(
    ...[
      `(func $str$index (param $$str_addr i32) (param $$str_ind i32) (result i32)`,
      `(local $$string_val i32) (local $$allocPointer i32)`,
      `(local.get $$str_ind)`,
      `(i32.const 0)(i32.lt_s)`, //check for negative index
      `(if (then (local.get $$str_addr)(i32.load)(i32.add (i32.const 1))(local.get $$str_ind)(i32.add)(local.set $$str_ind)))`, //if -ve, we do length + index
      `(local.get $$str_ind)(local.get $$str_addr)(i32.load)(i32.gt_s)`, //Check for +ve index out of bounds
      `(local.get $$str_ind)(i32.const 0)(i32.lt_s)`, //Check for -ve index out of bounds
      `(i32.or)`, // Check if string index is within bounds, i.e, b/w 0 and string_length
      `(if (then (i32.const -1)(call $print_str)(drop)))`, //Check if string index is out of bounds
      `(local.get $$str_addr)`,
      `(i32.add (i32.mul (i32.const 4)(local.get $$str_ind)))`, //Add the index * 4 value to the address
      `(i32.add (i32.const 4))`, //Adding 4 since string length is at first index
      `(i32.load)`, //Load the ASCII value of the string index
      `(local.set $$string_val)`, //store value in temp variable
      `(i32.const ${TAG_STRING})`,
      `(i32.const 8)`,
      `(call $$gcalloc)`,
      `(local.tee $$allocPointer)`,
      `(i32.const 0)`, //Length of string is 1
      `(i32.store)`, //Store length of string in the first position
      `(local.get $$allocPointer)`,
      `(i32.add (i32.const 4))`, //Add 4 since we have stored string length at beginning
      `(local.get $$string_val)`, //load value in temp variable
      `(i32.store)`, //Store the ASCII value in the new address
      `(local.get $$allocPointer)`,
      ")", //end func
    ]
  );
  strFunStmts.push(
    ...[
      `(func $str$equals (param $left_addr i32) (param $right_addr i32) (result i32)`,
      `(local $counter i32) (local $lhs_len i32) (local $rhs_len i32)`,
      `(i32.add (i32.load (local.get $left_addr)) (i32.const 1) )`,
      `(local.set $lhs_len)`,
      `(i32.add (i32.load (local.get $right_addr)) (i32.const 1) )`,
      `(local.set $rhs_len)`,
      `(i32.ne (local.get $lhs_len) (local.get $rhs_len))`,
      `(if (then (i32.const 0) (return) ))`, //return 0 if the two lengths are not equal
      `(i32.const 1)(local.set $counter)`,
      `(block (loop (br_if 1 (i32.le_s (local.get $counter) (local.get $lhs_len) )(i32.eqz) )`,
      `(i32.load (i32.add (local.get $left_addr) (i32.mul (local.get $counter) (i32.const 4))))`,
      `(i32.load (i32.add (local.get $right_addr) (i32.mul (local.get $counter) (i32.const 4))))`,
      `(i32.ne)`, //check if left and right string ascii values are not equal
      `(if (then (i32.const 0) (return)))`,
      `(i32.add (local.get $counter) (i32.const 1))(local.set $counter)`,
      `(br 0)`,
      `))`, //end block and loop
      `(i32.const 1)`,
      `)`,
    ]
  );
  strFunStmts.push(
    ...[
      `(func $str$greater (param $left_addr i32) (param $right_addr i32) (result i32)`,
      `(local $counter i32) (local $lhs_len i32) (local $rhs_len i32) (local $length i32) (local $str1 i32) (local $str2 i32)`,
      `(i32.add (i32.load (local.get $left_addr)) (i32.const 1) )`,
      `(local.set $lhs_len)`,
      `(i32.add (i32.load (local.get $right_addr)) (i32.const 1) )`,
      `(local.set $rhs_len)`,
      `(i32.gt_s (local.get $lhs_len) (local.get $rhs_len))`,
      `(if (then (local.get $rhs_len) (local.set $length)) (else (local.get $lhs_len) (local.set $length)))`, //return 0 if the two lengths are not equal
      `(i32.const 1)(local.set $counter)`,
      `(block (loop (br_if 1 (i32.le_s (local.get $counter) (local.get $length) )(i32.eqz) )`,
      `(i32.load (i32.add (local.get $left_addr) (i32.mul (local.get $counter) (i32.const 4))))(local.set $str1)`,
      `(i32.load (i32.add (local.get $right_addr) (i32.mul (local.get $counter) (i32.const 4))))(local.set $str2)`,
      `(local.get $str1)(local.get $str2)`,
      `(i32.gt_s)`, //check if left ascii is greater than right string ascii value
      `(if (then (i32.const 1) (return)))`,
      `(local.get $str1)(local.get $str2)`,
      `(i32.lt_s)`, //check if left ascii is less than right string ascii value
      `(if (then (i32.const 0) (return)))`,
      `(i32.add (local.get $counter) (i32.const 1))(local.set $counter)`,
      `(br 0)`,
      `))`, //end block and loop
      `(i32.gt_s (local.get $lhs_len) (local.get $rhs_len))`,
      `(if (then (i32.const 1) (return)) )`,
      `(i32.const 0)`,
      `)`,
    ]
  );
  strFunStmts.push(
    ...[
      `(func $str$greaterEq (param $left_addr i32) (param $right_addr i32) (result i32)`,
      `(local $counter i32) (local $lhs_len i32) (local $rhs_len i32) (local $length i32) (local $str1 i32) (local $str2 i32)`,
      `(i32.add (i32.load (local.get $left_addr)) (i32.const 1) )`,
      `(local.set $lhs_len)`,
      `(i32.add (i32.load (local.get $right_addr)) (i32.const 1) )`,
      `(local.set $rhs_len)`,
      `(i32.gt_s (local.get $lhs_len) (local.get $rhs_len))`,
      `(if (then (local.get $rhs_len) (local.set $length)) (else (local.get $lhs_len) (local.set $length)))`, //return 0 if the two lengths are not equal
      `(i32.const 1)(local.set $counter)`,
      `(block (loop (br_if 1 (i32.le_s (local.get $counter) (local.get $length) )(i32.eqz) )`,
      `(i32.load (i32.add (local.get $left_addr) (i32.mul (local.get $counter) (i32.const 4))))(local.set $str1)`,
      `(i32.load (i32.add (local.get $right_addr) (i32.mul (local.get $counter) (i32.const 4))))(local.set $str2)`,
      `(local.get $str1)(local.get $str2)`,
      `(i32.gt_s)`, //check if left ascii is greater than right string ascii value
      `(if (then (i32.const 1) (return)))`,
      `(local.get $str1)(local.get $str2)`,
      `(i32.lt_s)`, //check if left ascii is less than right string ascii value
      `(if (then (i32.const 0) (return)))`,
      `(i32.add (local.get $counter) (i32.const 1))(local.set $counter)`,
      `(br 0)`,
      `))`, //end block and loop
      `(i32.ge_s (local.get $lhs_len) (local.get $rhs_len))`,
      `(if (then (i32.const 1) (return)) )`,
      `(i32.const 0)`,
      `)`,
    ]
  );
  return strFunStmts;
}
function listBuiltInFuns(): Array<string> {
  let listFunStmts: Array<string> = [];
  //len function
  listFunStmts.push(
    ...[
      "(func $$list$len (param $$list_cmp i32) (result i32)",
      `(local.get $$list_cmp)`,
      `(i32.add (i32.const 4))`,
      `(i32.load)`,
      ...encodeLiteral,
      "(return))",
      "",
    ]
  );
  //append function
  listFunStmts.push(
    ...[
      "(func $$list$append (param $$list_cmp i32) (param $$val i32) (result i32)",
      `(local $$list_base i32)`,
      `(local $$list_index i32)`,
      `(local $$list_index2 i32)`,
      `(local $$list_size i32)`,
      `(local $$list_bound i32)`,
      `(local $$list_temp i32)`,
      `(if `, // check if list bounds need to expand
      `(i32.eq`,
      `(local.get $$list_cmp)`, // get address of current list
      `(i32.add (i32.const 8))`,
      `(i32.load)`, // load the bound of the list
      `(local.get $$list_cmp)`, // get address of current list
      `(i32.add (i32.const 4))`,
      `(i32.load)`, // load the size of the list
      `)`,
      `(then`,
      `(local.get $$list_cmp)`, // generate code for append element
      ...codeGenListCopy(ListCopyMode.Double),
      `(local.set $$list_cmp)`,
      `)`, // end then
      `)`, // end if
      `(local.get $$list_cmp)`,
      `(i32.add (i32.const 4))`,
      `(i32.load)`, //load index to store
      `(i32.mul (i32.const 4))`,
      `(i32.add (i32.const 12))`, // add base position
      `(i32.add (local.get $$list_cmp))`,
      `(local.get $$val)`,
      `(i32.store)`,
      `(local.get $$list_cmp)`,
      `(i32.add (i32.const 4))`,
      `(local.get $$list_cmp)`,
      `(i32.add (i32.const 4))`,
      `(i32.load)`,
      `(i32.add (i32.const 1))`, // add 1 to the size
      `(i32.store)`,
      `(local.get $$list_cmp)`,
      "(return))",
      "",
    ]
  );

  //index function //count could be very similar to this function
  listFunStmts.push(
    ...[
      "(func $$list$index (param $$list_cmp i32) (param $$val i32) (result i32)",
      `(local $$list_index i32)`, // to iterate through list
      `(local $$list_size i32)`, // size of list
      `(i32.const 0)`, // list_index = 0
      `(local.set $$list_index)`,
      `(local.get $$list_cmp)`, // load list_size from list metadata
      `(i32.add (i32.const 4))`,
      `(i32.load)`,
      `(local.set $$list_size)`,
      `(local.get $$list_cmp)`, // beginning of list
      `(i32.add (i32.const 12))`,
      `(local.set $$list_cmp)`,
      `(block`,
      `(loop`, // while loop for searching the value
      `(br_if 1`, // condition start
      `(local.get $$list_size)`,
      `(local.get $$list_index)`,
      `(i32.eq)`,
      `)`, // condition end
      // loop body start

      `(if `, // check if element of index match to the value
      `(i32.eq`,
      `(local.get $$list_cmp)`,
      `(local.get $$list_index)`,
      `(i32.mul (i32.const 4))`,
      `(i32.add)`,
      `(i32.load)`,
      `(local.get $$val)`,
      `)`,

      `(then`, // return index
      `(local.get $$list_index)`,
      ...encodeLiteral,
      `(return)`,
      `)`, // end then
      `)`, // end if
      `(local.get $$list_index)`,
      `(i32.add (i32.const 1))`,
      `(local.set $$list_index)`,

      `(br 0)`,
      `)`,
      `)`,
      `(i32.const -1)`, // find nothing
      ...encodeLiteral,
      "(return))",
      "",
    ]
  );

  //count function, similar to index
  listFunStmts.push(
    ...[
      "(func $$list$count (param $$list_cmp i32) (param $$val i32) (result i32)",
      `(local $$list_counter i32)`, // counter of how many times we see list_cmp
      `(local $$list_index i32)`, // to iterate through list
      `(local $$list_size i32)`, // size of list
      `(i32.const 0)`, // list_counter = 0
      `(local.set $$list_counter)`,
      `(i32.const 0)`, // list_index = 0
      `(local.set $$list_index)`,
      `(local.get $$list_cmp)`, // load list_size from list metadata
      `(i32.add (i32.const 4))`,
      `(i32.load)`,
      `(local.set $$list_size)`,
      `(local.get $$list_cmp)`, // beginning of list
      `(i32.add (i32.const 12))`,
      `(local.set $$list_cmp)`,
      `(block`,
      `(loop`, // while loop for searching the value
      `(br_if 1`, // condition start
      `(local.get $$list_size)`,
      `(local.get $$list_index)`,
      `(i32.eq)`,
      `)`, // condition end
      // loop body start

      `(if `, // check if element of index match to the value
      `(i32.eq`,
      `(local.get $$list_cmp)`,
      `(local.get $$list_index)`,
      `(i32.mul (i32.const 4))`,
      `(i32.add)`,
      `(i32.load)`,
      `(local.get $$val)`,
      `)`,

      `(then`, // add to count variable
      `(local.get $$list_counter)`,
      `(i32.add (i32.const 1))`,
      `(local.set $$list_counter)`,
      `)`, // end then
      `)`, // end if
      `(local.get $$list_index)`,
      `(i32.add (i32.const 1))`,
      `(local.set $$list_index)`,

      `(br 0)`,
      `)`,
      `)`,
      `(local.get $$list_counter)`, // return count
      ...encodeLiteral,
      "(return))",
      "",
    ]
  );

  //clear function
  //simply sets internal metadata size to 0
  listFunStmts.push(
    ...[
      "(func $$list$clear (param $$list_baseaddr i32) (result i32)",
      `(local.get $$list_baseaddr)`, // get address of list size
      `(i32.add (i32.const 4))`,
      `(i32.const 0)`, // store 0 into list size
      `(i32.store)`,
      `(local.get $$list_baseaddr)`, // return address of the list
      "(return))",
      "",
    ]
  );

  //copy function
  //creates new copy of that list and returns new copy's base addr
  listFunStmts.push(
    ...[
      "(func $$list$copy (param $$list_baseaddr i32) (result i32)",
      `(local $$list_base i32)`,
      `(local $$list_index i32)`,
      `(local $$list_bound i32)`,
      `(local $$list_temp i32)`,
      `(local $$list_cmp i32)`,
      `(local $$list_index2 i32)`,
      `(local $$list_size i32)`,
      `(local.get $$list_baseaddr)`,
      ...codeGenListCopy(ListCopyMode.Copy),
      "(return))",
      "",
    ]
  );

  //          ["append",[[tObj.a.content_type], tObj.a]],
  //           ["clear", [[], tObj.a]],
  //           ["copy",  [[], tObj.a]],
  //           ["count", [[tObj.a.content_type], NUM]],
  //           ["index", [[tObj.a.content_type], NUM]],

  //This function returns a memory address for the value of a key. It returns -1 if not found.
  return listFunStmts;
}

function dictUtilFuns(): Array<string> {
  let dictFunStmts: Array<string> = [];

  //This function returns a memory address for the value of a key.
  //If key is not found, throw a key not found error
  dictFunStmts.push(
    ...[
      "(func $dict$get (param $baseAddr i32) (param $key i32) (param $defaultValue i32) (result i32)",
      "(local $nodePtr i32)", // Local variable to store the address of nodes in linkedList
      "(local $tagHitFlag i32)", // Local bool variable to indicate whether tag is hit
      "(local $returnVal i32)",
      "(local.get $defaultValue)",
      "(local.set $returnVal)", // Initialize returnVal to defaultValue argument
      "(i32.const 0)",
      "(local.set $tagHitFlag)", // Initialize tagHitFlag to False
      "(local.get $baseAddr)",
      "(local.get $key)",
      "(i32.const 10)", //hard-coding hash table size
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
      "(local.get $defaultValue)",
      "(local.set $returnVal)", // Initialize returnVal to -1
      ")", //close then
      "(else",
      "(block",
      "(loop", // While loop till we find a node whose next is None
      "(local.get $nodePtr)",
      "(i32.load)", //Loading head of linkedList
      "(local.get $key)",
      "(i32.eq)", // if tag is same as the provided one
      "(if",
      "(then",
      "(local.get $nodePtr)",
      "(i32.const 4)",
      "(i32.add)", // Value
      "(i32.load)", //HT
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
  //This function clears dictionary.
  dictFunStmts.push(
    ...[
      "(func $dict$clear (param $baseAddr i32) (result i32)",
      "(local.get $baseAddr)",
      "(i32.const 0)", //None
      "(i32.store)", // Clearing Bucket-1

      "(local.get $baseAddr)",
      "(i32.const 4)",
      "(i32.add)",
      "(i32.const 0)", //None
      "(i32.store)", // Clearing Bucket-2

      "(local.get $baseAddr)",
      "(i32.const 8)",
      "(i32.add)",
      "(i32.const 0)", //None
      "(i32.store)", // Clearing Bucket-3

      "(local.get $baseAddr)",
      "(i32.const 12)",
      "(i32.add)",
      "(i32.const 0)", //None
      "(i32.store)", // Clearing Bucket-4

      "(local.get $baseAddr)",
      "(i32.const 16)",
      "(i32.add)",
      "(i32.const 0)", //None
      "(i32.store)", // Clearing Bucket-5

      "(local.get $baseAddr)",
      "(i32.const 20)",
      "(i32.add)",
      "(i32.const 0)", //None
      "(i32.store)", // Clearing Bucket-6

      "(local.get $baseAddr)",
      "(i32.const 24)",
      "(i32.add)",
      "(i32.const 0)", //None
      "(i32.store)", // Clearing Bucket-7

      "(local.get $baseAddr)",
      "(i32.const 28)",
      "(i32.add)",
      "(i32.const 0)", //None
      "(i32.store)", // Clearing Bucket-8

      "(local.get $baseAddr)",
      "(i32.const 32)",
      "(i32.add)",
      "(i32.const 0)", //None
      "(i32.store)", // Clearing Bucket-9

      "(local.get $baseAddr)",
      "(i32.const 36)",
      "(i32.add)",
      "(i32.const 0)", //None
      "(i32.store)", // Clearing Bucket-10

      "(i32.const 0)",
      "(return))",
      "",
    ]
  );

  //This function pops a key.
  dictFunStmts.push(
    ...[
      "(func $dict$pop (param $baseAddr i32) (param $key i32) (result i32)",
      "(local $prevPtr i32)", // Local variable to store the address of previous "next" nodes in linkedList
      "(local $currPtr i32)", // Local variable to store the address of current "head" nodes in linkedList
      "(local $returnVal i32)",
      "(i32.const -1)",
      "(local.set $returnVal)", // Initialize returnVal to -1
      "(local.get $baseAddr)",
      "(local.get $key)",
      "(i32.const 10)", // Hard-coding hashtable size
      "(i32.rem_s)", //Compute hash
      "(i32.mul (i32.const 4))", //Multiply by 4 for memory offset
      "(i32.add)", //Reaching the proper bucket. Call this bucketAddress
      "(local.set $prevPtr)", // prevPtr equal to bucketAddress
      "(local.get $prevPtr)",
      "(i32.load)",
      "(i32.const 0)", //None
      "(i32.eq)",
      "(if",
      "(then", // if the literal in bucketAddress is None i.e. checking if the bucket is empty
      "(i32.const -1)",
      "(local.set $returnVal)", // Initialize returnVal to -1
      ")", //close then
      "(else",
      "(local.get $prevPtr)",
      "(i32.load)", // Address of the head of linkedList.
      "(local.set $currPtr)", // currPtr stores the address of the head of the first node.
      "(block",
      "(loop",
      "(local.get $currPtr)",
      "(i32.load)",
      "(local.get $key)",
      "(i32.eq)", // if tag is same as the provided one
      "(if",
      "(then",
      "(local.get $currPtr)",
      "(i32.const 4)",
      "(i32.add)",
      "(local.set $returnVal)", // setting the returnValue to the address of value in the node.
      "(local.get $prevPtr)",
      "(local.get $currPtr)",
      "(i32.const 8)",
      "(i32.add)",
      "(i32.load)",
      "(i32.store)", // Updating the address of next in previous node to the next of the current node.
      "(local.get $currPtr)",
      "(i32.const 8)",
      "(i32.add)",
      "(local.set $prevPtr)", // Updating the prevPtr to the next of the current node.
      "(local.get $currPtr)",
      "(i32.const 8)",
      "(i32.add)",
      "(i32.load)",
      "(local.set $currPtr)", // Updating the currPtr
      ")", // closing then
      ")", // closing if
      "(br_if 0", // Opening br_if
      "(local.get $currPtr)",
      "(i32.const 0)", //None
      "(i32.ne)", // If currPtr not None
      ")", // Closing br_if
      "(br 1)",
      ")", // Closing loop
      ")", // Closing Block
      ")", //close else
      ")", // close if
      "(local.get $returnVal)",
      "(i32.load)",
      "(return))",
      "",
    ]
  );

  dictFunStmts.push(
    ...[
      "(func $ha$htable$CreateEntry (param $key i32) (param $val i32) (result i32)",
      "(local $$allocPointer i32)",
      `(i32.const ${TAG_DICT_ENTRY})    ;; heap-tag: opaque`,
      "(i32.const 12)   ;; size in bytes",
      "(call $$gcalloc)",
      "(local.tee $$allocPointer)",
      "(local.get $key)",
      "(i32.store)", // Dumping tag
      "(local.get $$allocPointer)",
      "(i32.const 4)",
      "(i32.add)", // Moving to the next block
      "(local.get $val)",
      "(i32.store)", // Dumping value
      "(local.get $$allocPointer)",
      "(i32.const 8)",
      "(i32.add)", // Moving to the next block
      "(i32.const 0)", //None
      "(i32.store)", // Dumping None in the next
      "(local.get $$allocPointer)",
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
      "(local $$allocPointer i32)",
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
      "(local.set $$allocPointer)",
      "(local.get $baseAddr)", // Recomputing the bucketAddress to update it.
      "(local.get $key)",
      "(local.get $hashtablesize)",
      "(i32.rem_s)", //Compute hash
      "(i32.mul (i32.const 4))", //Multiply by 4 for memory offset
      "(i32.add)", //Recomputed bucketAddress
      "(local.get $$allocPointer)",
      "(i32.store)", //Updated the bucketAddress pointing towards first element.
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
      "(local.set $$allocPointer)",
      "(local.get $nodePtr)", // Get the address of "next" block in node, whose next is None.
      "(local.get $$allocPointer)",
      "(i32.store)", // Updated the next pointing towards first element of new node.
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
  var [sign, size, words] = bigintToWords(num);
  var alloc = [
    `(i32.const ${TAG_BIGINT})`,
    `(i32.const ${(2 + size) * WORD_SIZE})`, // size in bytes
    `(call $$gcalloc)`,
    `(local.tee $$allocPointer)`,
    `(i32.add (i32.const ${0 * WORD_SIZE}))`, // add space for sign field
    `(i32.const ${sign})`,
    "(i32.store)", // store sign val
    `(local.get $$allocPointer)`,
    `(i32.add (i32.const ${1 * WORD_SIZE}))`, // move offset another 4 for size
    `(i32.const ${size})`, // size is only 32 bits :(
    "(i32.store)", // store size
  ];
  words.forEach((w, i) => {
    alloc = alloc.concat([
      `(local.get $$allocPointer)`,
      `(i32.add (i32.const ${(2 + i) * WORD_SIZE}))`, // advance pointer
      `(i32.const ${w})`,
      ...encodeLiteral,
      "(i32.store)", // store
    ]);
  });
  alloc = alloc.concat([
    `(local.get $$allocPointer)`, // address for the number
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

// @param:  loc: Location of the stmt/expr
//          code: codes for the parameters to pass in the check function
//          func: ENUM to identify the checkFunction.
function codeGenRuntimeCheck(loc: Location, code: Array<string>, func: RunTime): Array<string> {
  if (func == RunTime.CHECK_VALUE_ERROR) return [];
  return [...codeGenPushStack(loc), ...code, `(call $$${func.toString()})`, ...codeGenPopStack()];
}

function codeGenPushStack(loc: Location): Array<string> {
  return [
    `(i32.const ${loc.line})`,
    `(i32.const ${loc.col})`,
    `(i32.const ${loc.length})`,
    `(i32.const ${loc.fileId})`,
    "(call $$pushStack)",
  ];
}

function codeGenPopStack(): Array<string> {
  return ["(call $$popStack)"];
}

function codeGenCall(loc: Location, code: string): Array<string> {
  return [...codeGenPushStack(loc), code, ...codeGenPopStack()];
}

function codeGenListElemType(elemTyp: Type): string {
  switch (elemTyp.tag) {
    case "number":
      return `(i32.const ${ListContentTag.Num})`;
    case "bool":
      return `(i32.const ${ListContentTag.Bool})`;
    case "none":
      return `(i32.const ${ListContentTag.None})`;
    case "string":
      return `(i32.const ${ListContentTag.Str})`;
    case "class":
      return `(i32.const ${ListContentTag.Class})`;
    case "list":
      return `(i32.const ${ListContentTag.List})`;
    case "dict":
      return `(i32.const ${ListContentTag.Dict})`;
    case "callable":
      return `(i32.const ${ListContentTag.Callable})`;
  }
}
function isInternal(s: string): boolean {
  return s.substring(1).indexOf("$") !== -1;
}

// Required so that heap-allocated temporaries are considered rooted/reachable
// Without the call to `captureTemps`, heap-allocated temporaries may be accidently
//   freed
// Necessary because cannot scan the WASM stack for pointers so the MemoryManager
//   must maintain its own list of reachable objects
function codeGenTempGuard(c: Array<string>, kind: number): Array<string> {
  switch (kind) {
    case FENCE_TEMPS:
      return ["(call $$captureTemps)"].concat(c).concat(["(call $$releaseTemps)"]);

    case HOLD_TEMPS:
      return ["(call $$captureTemps)"].concat(c);

    case RELEASE_TEMPS:
      return c.concat(["(call $$releaseTemps)"]);
  }
}
