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
  Assignable,
} from "./ast";
import { NUM, BOOL, NONE, CLASS, STRING, unhandledTag, unreachable } from "./utils";
import * as BaseException from "./error";
import {
  MemoryManager,
  TAG_BIGINT,
  TAG_CLASS,
  TAG_DICT,
  TAG_LIST,
  TAG_REF,
  TAG_STRING,
} from "./alloc";

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

export const encodeLiteral: Array<string> = [
  `(i32.const ${nTagBits})`,
  "(i32.shl)",
  "(i32.const 1)", // literals are tagged with a 1 in the LSB
  "(i32.add)",
];

export const decodeLiteral: Array<string> = [`(i32.const ${nTagBits})`, "(i32.shr_s)"];
export function augmentEnv(env: GlobalEnv, prog: Program<Type>, mm: MemoryManager): GlobalEnv {
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
      mm.addGlobal(globalAddr);
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

export function compile(ast: Program<Type>, env: GlobalEnv, mm: MemoryManager): CompileResult {
  console.log("program", ast);
  const withDefines = augmentEnv(env, ast, mm);

  let stackIndexOffset = 0; // NOTE(alex:mm): assumes start function has no params
  const definedVars: Set<string> = new Set(); //getLocals(ast);
  definedVars.add("$last");
  definedVars.add("$allocPointer"); // Used to cache the result of `gcalloc`
  definedVars.add("$list_base");
  definedVars.add("$list_index");
  definedVars.add("$list_temp");
  definedVars.add("$list_bound");
  definedVars.add("$list_cmp");
  definedVars.add("$list_cmp2");
  definedVars.add("$addr"); // by closure group
  definedVars.add("$destruct");
  definedVars.add("$string_val"); //needed for string operations
  definedVars.add("$string_class"); //needed for strings in class
  definedVars.add("$string_index"); //needed for string index check out of bounds
  definedVars.add("$string_address"); //needed for string indexing
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

  // use the called functions to determine top level functions
  // require support from AST
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
    let idx = env.funs.get(fun)[0];
    let length = env.funs.get(fun)[1].length;
    let loc = envLookup(env, fun);
    inits.push(myMemAlloc(`$$addr`, (length + 1) * 4).join("\n"));
    inits.push(`(i32.store (local.get $$addr) (i32.const ${idx}))`);
    inits.push(`(i32.store (i32.const ${loc}) (local.get $$addr)) ;; global function`);
  });
  // global functions have no nonlocals, assert length == 0
  return inits;
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
      var valStmts = codeGenTempGuard(codeGenExpr(stmt.value, env), FENCE_TEMPS);

      // returnTemp places the return expr value into the caller's temp set
      // NOTE(alex:mm): We need to put temporaries and escaping pointers into
      //   the calling statement's temp frame, not a new one.
      //
      // By placing them into the calling statement's temp frame, escaping pointers
      //   have an opportunity to be rooted without fear of the GC cleaning it up
      // TODO(alex:mm): instead of relying on escape analysis, we'll just try to
      //   add the returned value to the parent temp frame
      valStmts.push("(call $$returnTemp)");
      valStmts.push("(call $$releaseLocals)");
      valStmts.push("return");

      return valStmts;
    case "assignment":
      const valueCode = codeGenExpr(stmt.value, env);
      const getValue = "(local.get $$destruct)";

      // TODO(alex): make more granular?
      return codeGenTempGuard(
        [...valueCode, "local.set $$destruct", ...codeGenDestructure(stmt.destruct, getValue, env)],
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
      return [
        `${condExpr.join("\n")} \n (if (then ${thnStmts.join("\n")}) (else ${elsStmts.join(
          "\n"
        )}))`,
      ];
    case "while":
      var wcondExpr = codeGenTempGuard(
        codeGenExpr(stmt.cond, env).concat(decodeLiteral),
        FENCE_TEMPS
      );
      var bodyStmts = stmt.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      return [
        `(block (loop (br_if 1 ${wcondExpr.join("\n")}\n(i32.eqz)) ${bodyStmts.join(
          "\n"
        )} (br 0) ))`,
      ];
    case "for":
      var bodyStmts = stmt.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
      var iter = codeGenExpr(stmt.iterable, env);

      var rgExpr: Expr<Type> = { a: CLASS("Range"), tag: "id", name: "rg" };
      var Expr_cur: Expr<Type> = { a: NUM, tag: "lookup", obj: rgExpr, field: "cur" };
      var Code_cur = codeGenExpr(Expr_cur, env);

      var Expr_stop: Expr<Type> = { a: NUM, tag: "lookup", obj: rgExpr, field: "stop" };
      var Code_stop = codeGenExpr(Expr_stop, env);

      var Expr_step: Expr<Type> = { a: NUM, tag: "lookup", obj: rgExpr, field: "step" };
      var Code_step = codeGenExpr(Expr_step, env);

      // name = cur
      var ass: Stmt<Type> = {
        a: NONE,
        tag: "assignment",
        destruct: makeId(NUM, stmt.name),
        value: Expr_cur,
      };
      var Code_ass = codeGenStmt(ass, env);

      // add step to cur
      var ncur: Expr<Type> = {
        a: NUM,
        tag: "binop",
        op: BinOp.Plus,
        left: Expr_cur,
        right: Expr_step,
      };
      var step: Stmt<Type> = {
        a: NONE,
        tag: "field-assign",
        obj: rgExpr,
        field: "cur",
        value: ncur,
      };
      var Code_step = codeGenStmt(step, env);

      // stop condition cur<step
      var Expr_cond: Expr<Type> = {
        a: BOOL,
        tag: "binop",
        op: BinOp.Gte,
        left: Expr_cur,
        right: Expr_stop,
      };
      var Code_cond = codeGenExpr(Expr_cond, env);

      // if have index
      if (stmt.index) {
        var iass: Stmt<Type> = {
          a: NONE,
          tag: "assignment",
          destruct: makeId(NUM, stmt.index),
          value: { a: NUM, tag: "literal", value: { tag: "num", value: BigInt(0) } },
        };
        var Code_iass = codeGenStmt(iass, env);

        var nid: Expr<Type> = {
          a: NUM,
          tag: "binop",
          op: BinOp.Plus,
          left: { a: NUM, tag: "id", name: stmt.index },
          right: { a: NUM, tag: "literal", value: { tag: "num", value: BigInt(1) } },
        };
        var niass: Stmt<Type> = {
          a: NONE,
          tag: "assignment",
          destruct: makeId(NUM, stmt.index),
          value: nid,
        };
        var Code_idstep = codeGenStmt(niass, env);

        // iterable should be a Range object
        return [
          `
          (i32.const ${envLookup(env, "rg")})
          ${iter.join("\n")}
          (i32.store)
          ${Code_iass.join("\n")}
          (block
            (loop

              (br_if 1 ${Code_cond.join("\n")})

              ${Code_ass.join("\n")}
              ${bodyStmts.join("\n")}
              ${Code_step.join("\n")}
              ${Code_idstep.join("\n")}

              (br 0)
          ))`,
        ];
      }

      // iterable should be a Range object
      return [
        `
        (i32.const ${envLookup(env, "rg")})
        ${iter.join("\n")}
        (i32.store)
        (block
          (loop
            (br_if 1 ${Code_cond.join("\n")})

            ${Code_ass.join("\n")}
            ${bodyStmts.join("\n")}
            ${Code_step.join("\n")}

            (br 0)
        ))`,
      ];
    case "pass":
      return [];
    case "break":
      // break to depth
      return [`(br_if ${stmt.depth} (i32.const 1))`];
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
function codeGenDestructure(destruct: Destructure<Type>, value: string, env: GlobalEnv): string[] {
  let assignStmts: string[] = [];

  if (destruct.isDestructured) {
    const objTyp = destruct.valueType;
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
      throw new Error("Destructuring not supported yet for types other than 'class'");
    }
  } else {
    const target = destruct.targets[0];
    if (!target.ignore) {
      assignStmts = codeGenAssignable(target.target, [value], env);
    }
  }

  return assignStmts;
}

function codeGenAssignable(target: Assignable<Type>, value: string[], env: GlobalEnv): string[] {
  // NOTE(alex:mm): temp guards are generated at the statement level
  switch (target.tag) {
    case "id": // Variables
      if (env.locals.has(target.name)) {
        const localIndex = env.locals.get(target.name);
        const result = [
          ...value,
          `(local.set $${target.name})`,
          `(i32.const ${localIndex.toString()})`,
          `(local.get $${target.name})`,
          `(call $$addLocal)`,
        ];

        return result;
      } else {
        const locationToStore = [`(i32.const ${envLookup(env, target.name)}) ;; ${target.name}`];
        return [...locationToStore, ...value, "(i32.store)"];
      }
    case "lookup": // Field lookup
      const objStmts = codeGenExpr(target.obj, env);
      const objTyp = target.obj.a;
      if (objTyp.tag !== "class") {
        // I don't think this error can happen
        throw new Error(
          "Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag
        );
      }
      var className = objTyp.name;
      var [offset, _] = env.classes.get(className).get(target.field);
      const result = [...objStmts, `(i32.add (i32.const ${offset * 4}))`, ...value, `(i32.store)`];
      return result;
    case "bracket-lookup":
      switch (target.obj.a.tag) {
        case "dict":
          return codeGenExpr(target.obj, env).concat(codeGenDictKeyVal(target.key, value, 10, env));
        case "list":
        default:
          throw new Error("Bracket-assign for types other than dict not implemented");
      }
    default:
      // Force type error if assignable is added without implementation
      // At the very least, there should be a stub
      const err: never = <never>target;
      throw new Error(`Unknown target ${JSON.stringify(err)} (compiler)`);
  }
}

function codeGenInit(init: VarInit<Type>, env: GlobalEnv): Array<string> {
  const value = codeGenLiteral(init.value);
  if (env.locals.has(init.name)) {
    return [...value, `(local.set $${init.name})`];
  } else {
    const locationToStore = [`(i32.const ${envLookup(env, init.name)}) ;; ${init.name}`];
    return locationToStore.concat(value).concat([`(i32.store)`]);
  }
}

// NOTE(alex:mm): Assuming this is only called for closure allocation
//   which uses a class-based layout
function myMemAlloc(name: string, sizeInValueCount: number): Array<string> {
  const allocs: Array<string> = [];
  const sizeInBytes = sizeInValueCount * 4;
  allocs.push(`(i32.const ${Number(TAG_REF)}) ;; heap-tag: ref`);
  allocs.push(`(i32.const ${sizeInBytes})`);
  allocs.push(`(call $$gcalloc)`);
  allocs.push(`(local.set ${name}) ;; allocate memory for ${name}`);
  return allocs;
}

function initNested(nested: Array<string>, env: GlobalEnv): Array<string> {
  // this is where the closure is constructed
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
      inits.push(
        `(i32.store (i32.add (local.get $$addr) (i32.const ${(i + 1) * 4})) (local.get $${v}_$ref))`
      );
    });
    inits.push(`(i32.store (local.get $${fun}_$ref) (local.get $$addr))`);
  });

  return inits;
}

const funPtr = "$funPtr"; // the first extra argument

function initNonlocals(nonlocals: Array<string>): Array<string> {
  const inits: Array<string> = [];
  nonlocals.forEach((v, i) => {
    inits.push(`(i32.load (i32.add (local.get ${funPtr}) (i32.const ${(i + 1) * 4})))`);
    inits.push(`(local.set $${v}_$ref)`);
  });

  return inits;
}

function initRef(refs: Set<string>): Array<string> {
  const inits: Array<string> = [];
  refs.forEach((name) => {
    inits.push(myMemAlloc(`$${name}_$ref`, 1).join("\n"));
    inits.push(`(i32.store (local.get $${name}_$ref) (local.get $${name}))`);
  });

  return inits;
}

function codeGenClosureDef(def: ClosureDef<Type>, env: GlobalEnv): Array<string> {
  let currentLocalIndex = 0;
  const definedVars: Set<string> = new Set();
  definedVars.add("$allocPointer"); // Used to cache the result of `gcalloc`
  definedVars.add("$last");
  definedVars.add("$addr");
  definedVars.add("$destruct");
  definedVars.add("$string_val"); //needed for string operations
  definedVars.add("$string_class"); //needed for strings in class
  definedVars.add("$string_index"); //needed for string index check out of bounds
  definedVars.add("$string_address"); //needed for string indexing
  def.nonlocals.forEach((v) => definedVars.add(`${v}_$ref`)); // nonlocals are reference, ending with '_$ref'
  def.nested.forEach((v) => definedVars.add(`${v}_$ref`)); // nested functions are references of function ptrs, ending with _$ref
  def.inits.forEach((v) => definedVars.add(`${v.name}`));
  def.inits.forEach((v) => definedVars.add(`${v.name}_$ref`));
  def.parameters.forEach((p) => definedVars.add(`${p.name}_$ref`));

  const extraRefs: Set<string> = new Set();
  def.inits.forEach((v) => extraRefs.add(`${v.name}`));
  def.parameters.forEach((p) => extraRefs.add(`${p.name}`));

  definedVars.forEach((v) => {
    env.locals.set(v, currentLocalIndex);
    currentLocalIndex += 1;
  });

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
    `(func $${def.name} (param ${funPtr} i32) ${params} (result i32)
    ${localDefs}
    (call $$pushFrame)
    ${inits}
    ${refs}
    ${nonlocals}
    ${nested}
    ${stmts}
    (call $$releaseLocals)
    (i32.const 0)
    (return)
    )`,
  ];
}

function codeGenFunDef(def: FunDef<Type>, env: GlobalEnv): Array<string> {
  var definedVars: Set<string> = new Set();
  def.inits.forEach((v) => definedVars.add(v.name));
  definedVars.add("$last");
  // Used to cache the result of `gcalloc` and dump
  //   it to the stack for initialization
  // NOTE(alex:mm): need to `local.get` object pointer BEFORE generating code
  //   for inner expressions
  definedVars.add("$allocPointer"); // Used to cache the result of `gcalloc`
  definedVars.add("$destruct");
  definedVars.add("$string_val"); //needed for string operations
  definedVars.add("$string_class"); //needed for strings in class
  definedVars.add("$string_index"); //needed for string index check out of bounds
  definedVars.add("$string_address"); //needed for string indexing

  // NOTE(alex:mm): parameters indices go first
  let currLocalIndex = 0;
  var params = def.parameters
    .map((p) => {
      env.locals.set(p.name, currLocalIndex);
      currLocalIndex += 1;
      return `(param $${p.name} i32)`;
    })
    .join(" ");

  // def.parameters.forEach(p => definedVars.delete(p.name));
  definedVars.forEach((v) => {
    env.locals.set(v, currLocalIndex);
    currLocalIndex += 1;
  });

  const localDefines = makeLocals(definedVars);
  const locals = localDefines.join("\n");
  const inits = def.inits
    .map((init) => codeGenInit(init, env))
    .flat()
    .join("\n");
  var stmts = def.body.map((innerStmt) => codeGenStmt(innerStmt, env)).flat();
  var stmtsBody = stmts.join("\n");
  env.locals.clear();
  return [
    `(func $${def.name} ${params} (result i32)
    ${locals}
    (call $$pushFrame)
    ${inits}
    ${stmtsBody}
    (call $$releaseLocals)
    (i32.const 0)
    (return))`,
  ];
}

function codeGenClass(cls: Class<Type>, env: GlobalEnv): Array<string> {
  const methods = [...cls.methods];
  methods.forEach((method) => (method.name = `${cls.name}$${method.name}`));
  const result = methods.map((method) => codeGenFunDef(method, env));
  return result.flat();
}

// If concat is 0, then the function generate code for list.copy()
// If concat is 2, then the function generate code for concat.
// If concat is 3, then the function generate code for append.
function codeGenListCopy(concat: number): Array<string> {
  var stmts: Array<string> = [];
  var loopstmts: Array<string> = [];
  var condstmts: Array<string> = [];
  var tempstmts: Array<string> = [];
  var listType = 10; //temporary list type number
  var header = [4, 8]; //size, bound relative position
  var cmp = [""];
  stmts.push(...[`(local.set $$list_cmp)`]); //store first address to local var
  if (concat == 2) {
    stmts.push(...[`(local.set $$list_cmp2)`]);
    tempstmts = [`(local.get $$list_cmp2)`, `(i32.add (i32.const 8))`, `(i32.load)`, `(i32.add)`];
    cmp = ["", "2"];
  }
  if (concat == 3) {
    tempstmts = tempstmts.concat("(i32.mul (i32.const 2))");
  }

  stmts.push(
    ...[
      `(i32.const ${TAG_LIST})    ;; heap-tag: list`,
      `(local.get $$list_cmp)`, // load capacty
      `(i32.add (i32.const 8))`,
      `(i32.load)`,
    ]
  );
  stmts.push(...tempstmts);
  stmts.push(
    ...[
      `(i32.mul (i32.const 4))`, // new_cap = cap * 4 + 12
      `(i32.add (i32.const 12))`,
      `(call $$gcalloc)`,
      `(local.set $$list_base)`,
    ]
  );

  //add/modify header info of the list
  header.forEach((addr) => {
    var double_size = addr == 8 && concat == 3 ? [`(i32.mul (i32.const 2))`] : [];
    var tempstmts =
      concat == 2
        ? [`(local.get $$list_cmp2)`, `(i32.add (i32.const ${addr}))`, `(i32.load)`, `(i32.add)`]
        : [];
    stmts.push(
      ...[
        `(local.get $$list_base)`,
        `(i32.add (i32.const ${addr}))`,
        `(local.get $$list_cmp)`,
        `(i32.add (i32.const ${addr}))`,
        `(i32.load)`,
        ...tempstmts,
        ...double_size,
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
      `(local.get $$list_temp)`,
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
      `(local.get $$list_temp)`,
      `(i32.add (i32.const 1))`,
      `(local.set $$list_temp)`,
    ]
  );

  cmp.forEach((s) => {
    if (s === ``) {
      stmts.push(
        ...[
          `(i32.const 0)`,
          `(local.set $$list_bound)`,
          `(i32.const 0)`,
          `(local.set $$list_temp)`, //second index
        ]
      );
    } else {
      stmts.push(...[`(local.get $$list_cmp2)`, `(local.set $$list_cmp)`]);
    }

    stmts.push(
      ...[
        `(i32.const 0)`,
        `(local.set $$list_index)`,
        `(local.get $$list_cmp)`,
        `(i32.add (i32.const 4))`,
        `(i32.load)`,
        `(i32.add (local.get $$list_bound))`,
        `(local.set $$list_bound)`,
      ]
    );

    //while loop structure
    stmts.push(
      ...[
        `(block`,
        `(loop`,
        `(br_if 1 ${condstmts.join("\n")})`,
        `${loopstmts.join("\n")}`,
        `(br 0)`,
        `)`,
        `)`,
      ]
    );
  });

  return stmts.concat([
    `(local.get $$list_base)`, // Get address for the object (this is the return value)
  ]);
}

function codeGenExpr(expr: Expr<Type>, env: GlobalEnv): Array<string> {
  switch (expr.tag) {
    case "builtin1":
      const argTyp = expr.a;
      console.log(argTyp);
      console.log(expr.name);
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
        return [`(local.get $${expr.name})`];
      } else {
        return [`(i32.const ${envLookup(env, expr.name)})`, `(i32.load)`];
      }
    case "binop":
      const lhsStmts = codeGenExpr(expr.left, env);
      const rhsStmts = codeGenExpr(expr.right, env);
      if (typeof expr.left.a !== "undefined" && expr.left.a.tag === "list") {
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
      var valStmts = expr.arguments.map((arg) => codeGenExpr(arg, env)).flat();
      valStmts.push(`(call $$pushCaller)`);
      valStmts.push(`(call $${expr.name})`);
      valStmts.push(`(call $$popCaller)`);
      return valStmts;
    case "call_expr":
      const callExpr: Array<string> = [];
      const nameExpr = expr.name;
      let funName: string;
      if (nameExpr.tag == "id") {
        // until now, all the function variables are wrapped in references
        // the 'id's serves for global functions
        funName = nameExpr.name;
        callExpr.push(`(i32.load (i32.const ${envLookup(env, funName)})) ;; argument for $funPtr`);
        expr.arguments.forEach((arg) => {
          callExpr.push(codeGenExpr(arg, env).join("\n"));
        });

        // NOTE(alex:mm): necessary in order to root the return value
        callExpr.push(`(call $$pushCaller)`);
        callExpr.push(
          `(call_indirect (type $callType${
            expr.arguments.length + 1
          }) (i32.load (i32.load (i32.const ${envLookup(env, funName)}))))`
        );
        callExpr.push(`(call $$popCaller)`);
      } else if (nameExpr.tag == "lookup") {
        funName = (nameExpr.obj as any).name;
        callExpr.push(`(i32.load (local.get $${funName})) ;; argument for $funPtr`);
        expr.arguments.forEach((arg) => {
          callExpr.push(codeGenExpr(arg, env).join("\n"));
        });
        // NOTE(alex:mm): necessary in order to root the return value
        callExpr.push(`(call $$pushCaller)`);
        callExpr.push(
          `(call_indirect (type $callType${
            expr.arguments.length + 1
          }) (i32.load (i32.load (local.get $${funName}))))`
        );
        callExpr.push(`(call $$popCaller)`);
      } else {
        throw new Error(`Compile Error. Invalid name of tag ${nameExpr.tag}`);
      }
      return callExpr;
    case "construct":
      var stmts: Array<string> = [
        `(i32.const ${Number(TAG_CLASS)})   ;; heap-tag: class`,
        `(i32.const ${env.classes.get(expr.name).size * 4})   ;; size in bytes`,
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
            "(i32.store)", // Put the default field value on the heap
          ]
        )
      );
      return stmts.concat([
        // Pointer to deref should be on the top of the stack already
        `(call $${expr.name}$__init__)`, // call __init__
        `(drop)`, // Drop None from __init__
        // Pointer to return should be on the top of the stack already
      ]);
    case "method-call":
      var objStmts = codeGenExpr(expr.obj, env);
      var objTyp = expr.obj.a;
      if (objTyp.tag !== "class") {
        // I don't think this error can happen
        throw new Error(
          "Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag
        );
      }
      var className = objTyp.name;
      var argsStmts = expr.arguments
        .map((arg) => codeGenExpr(arg, env))
        .flat()
        .concat();
      return [
        ...objStmts,
        ...argsStmts,
        `(call $$pushCaller)`,
        `(call $${className}$${expr.method})`,
        `(call $$popCaller)`,
      ];
    case "lookup":
      var objStmts = codeGenExpr(expr.obj, env);
      var objTyp = expr.obj.a;
      if (objTyp.tag !== "class") {
        // I don't think this error can happen
        throw new Error(
          "Report this as a bug to the compiler developer, this shouldn't happen " + objTyp.tag
        );
      }
      var className = objTyp.name;
      var [offset, _] = env.classes.get(className).get(expr.field);
      return [...objStmts, `(i32.add (i32.const ${offset * 4}))`, `(i32.load)`];
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
      switch (expr.obj.a.tag) {
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
          throw new Error("Code gen for bracket-lookup for types other than dict not implemented");
      }
    default:
      unhandledTag(expr);
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
  var i = 1;
  // NOTE(alex:mm): It looks like characters are stored in 4 bytes?
  const allocSizeBytes = (string_val.length + 1) * 4;
  // Storing the length of the string at the beginning
  // TODO(alex:mm): Where is the length storing code?
  stmts.push(
    ...[
      `(i32.const ${Number(TAG_STRING)})  ;; heap-tag: string`,
      `(i32.const ${allocSizeBytes})`,
      `(call $$gcalloc)`,
      `(local.set $$allocPointer)`,
      `(local.get $$allocPointer)`,
      `(i32.const ${string_val.length - 1})`, // Store ASCII value for 0 (end of string)
      "(i32.store)", // Store the ASCII value 0 in the new address
    ]
  );
  while (i != string_val.length + 1) {
    const char_ascii = string_val.charCodeAt(i - 1);
    stmts.push(
      ...[
        `(local.get $$allocPointer)`,
        `(i32.add (i32.const ${i * 4}))`, // Calc string index offset from heap offset
        `(i32.const ${char_ascii})`, // Store the ASCII value of the string index
        "(i32.store)", // Store the ASCII value in the new address
      ]
    );
    i += 1;
  }
  return stmts.concat([
    `(local.get $$allocPointer)`, // return the allocated pointer
  ]);
}

function codeGenDictBracketLookup(
  obj: Expr<Type>,
  key: Expr<Type>,
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
  key: Expr<Type>,
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
  // NOTE(alex:mm): $$allocPointer is clobbered when codegen'ing inner exprs
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
