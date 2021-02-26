import { ClassDef, ClassType, Expr, FuncDef, FuncType, Literal, Program, Stmt, VarDef } from "./ast";
import { Env, EnvManager } from "./env";
import { MemoryManager } from "./memory";
import { parse } from "./parser";
import { tcProgram } from "./typechecker";
import * as constant from "./constant"

let memoryManager: MemoryManager;
let envManager: EnvManager;
let curEnv: Env;

function getValFromPtr(p: number): Array<string> {
  return [
    `(i32.const ${p * constant.WORD_SIZE})`,
    `(i32.load)`,
  ];
}

function getPtrFromPtrPtr(pp: number): Array<string> {
  return getValFromPtr(pp);
}

function getPtrFromPtrPtrOffset(pp: number, offset: number): Array<string> {
  return [
    `(i32.const ${pp * constant.WORD_SIZE})`,
    `(i32.load)`,
    `(i32.const ${offset * constant.WORD_SIZE})`,
    `(i32.add)`,
  ];
}

function setValWithPtrExpr(p: number, expr: Array<string>): Array<string> {
  let wasms: Array<string> = new Array();
  wasms = wasms.concat(
    [`(i32.const ${p * constant.WORD_SIZE})`],
    expr,
    [`(i32.store)`]
  )
  return wasms;
}

function setValWithPtr(p: number, value: number): Array<string> {
  return setValWithPtrExpr(p, [`(i32.const ${value})`]);
}

function setValWithPtrPtrOffsetExpr(pp: number, offset: number, expr: Array<string>): Array<string> {
  let wasms: Array<string> = new Array();
  wasms = wasms.concat(
    getPtrFromPtrPtrOffset(pp, offset),
    expr,
    [`(i32.store)`]
  )
  return wasms;
}

function setValWithPtrPtrOffset(pp: number, offset: number, value: number): Array<string> {
  return setValWithPtrPtrOffsetExpr(pp, offset, [`i32.const ${value}`]);
}

function setPtrWithPtrPtrOffset(pp: number, offset: number): Array<string> {
  return setValWithPtrExpr(pp, getPtrFromPtrPtrOffset(pp, offset));
}

function storeTempValueWithExpr(p: number, expr: Array<string>): Array<string> {
  return setValWithPtrExpr(p, expr);
}

function loadTempValue(p: number): Array<string> {
  return getValFromPtr(p);
}

function findVarPosition(name: string): Array<string> {
  let iterEnv = curEnv;
  let wasms: Array<string> = new Array();
  wasms = wasms.concat(
    getPtrFromPtrPtrOffset(constant.PTR_DL, -1),
  )
  while (!iterEnv.nameToVar.has(name)) {
    iterEnv = iterEnv.parent;
    wasms = wasms.concat([`i32.load`]);
  }

  wasms = wasms.concat(
    [`i32.const ${(-1 - iterEnv.nameToVar.get(name).offset) * constant.WORD_SIZE}`],
    [`i32.add`]
  );
  return wasms;
}

function getMethodFromPtr(ct: ClassType, methodName: string): Array<string> {
  return [
    `(i32.const ${(ct.getDispatchTablePtrOffset()) * constant.WORD_SIZE})`,
    `(i32.add)`,
    `(i32.load)`,  // dispatch table ptr
    `(i32.const ${(ct.methodPtrs.get(methodName)) * constant.WORD_SIZE})`,
    `(i32.add)`,
    `(i32.load)`,
  ]
}

function getAttributeFromPtr(ct: ClassType, attrName: string): Array<string> {
  return [
    `(i32.const ${(
    ct.headerSize + ct.attributes.get(attrName).offset) * constant.WORD_SIZE})`,
    `(i32.add)`,
    `(i32.load)`
  ];
}

const binaryOpToWASM: Map<string, Array<string>> = new Map([
  ["+", ["(i32.add)"]],
  ["-", ["(i32.sub)"]],
  ["*", ["(i32.mul)"]],
  ["//", ["(i32.div_s)"]],
  ["%", ["(i32.rem_s)"]],
  ["==", ["(i32.eq)"]],
  ["!=", ["(i32.ne)"]],
  ["<=", ["(i32.le_s)"]],
  [">=", ["(i32.ge_s)"]],
  ["<", ["(i32.lt_s)"]],
  [">", ["(i32.gt_s)"]],
  ["is", ["(i32.eq)"]],
  ["and", ["(i32.and)"]],
  ["or", ["(i32.or)"]],
])

function codeGenCallerInit(loadParam: Array<string>): Array<string> {
  let wasms: Array<string> = new Array();

  wasms = wasms.concat(
    setValWithPtrPtrOffsetExpr(constant.PTR_SP, -1, getPtrFromPtrPtr(constant.PTR_DL)),
    setValWithPtrPtrOffsetExpr(constant.PTR_SP, -2, getPtrFromPtrPtrOffset(constant.PTR_DL, -1)),
    storeTempValueWithExpr(constant.PTR_T2, getPtrFromPtrPtrOffset(constant.PTR_SP, -1)),  // store new DL
    setPtrWithPtrPtrOffset(constant.PTR_SP, -2),
    loadParam,
    setValWithPtrExpr(constant.PTR_DL, loadTempValue(constant.PTR_T2)),
  )
  return wasms;
}

function codeGenCallerDestroy(): Array<string> {
  let wasms: Array<string> = new Array();

  let loadDL: Array<string> = new Array();
  loadDL = loadDL.concat(
    getPtrFromPtrPtr(constant.PTR_DL),
    [`(i32.load)`]
  )

  wasms = wasms.concat(
    setValWithPtrExpr(constant.PTR_SP, getPtrFromPtrPtrOffset(constant.PTR_DL, 1)),
    setValWithPtrExpr(constant.PTR_DL, loadDL),
  )
  return wasms;
}

function codeGenLiteral(l: Literal): Array<string> {
  return [`(i32.const ${literalToVal(l)})`];
}

function literalToVal(l: Literal): number {
  switch (l.tag) {
    case "True":
      return 1;
    case "number":
      return l.value;
    default:
      return 0;
  }
}

function codeGenAlloc(ct: ClassType): Array<string> {
  let wasms: Array<string> = new Array();
  wasms = wasms.concat(
    [`;; Allocating class ${ct.getName()}`],
    setValWithPtrPtrOffset(constant.PTR_EP, 0, -1),  // tag
    setValWithPtrPtrOffset(constant.PTR_EP, 1, ct.size),  // size
    setValWithPtrPtrOffset(
      constant.PTR_EP, 2, 
      (ct.methodPtrsHead + constant.PTR_DTABLE) * constant.WORD_SIZE
    ),  // dtable
  )

  ct.attributes.forEach(attr => {
    wasms = wasms.concat(
      setValWithPtrPtrOffset(constant.PTR_EP, ct.headerSize + attr.offset, literalToVal(attr.value))
    );
  });

  wasms = wasms.concat(
    getPtrFromPtrPtr(constant.PTR_EP),  // leave a ptr as result
    setPtrWithPtrPtrOffset(constant.PTR_EP, ct.size),  // update EP
  )

  return wasms;
}


function codeGenExpr(expr: Expr): Array<string> {
  let wasms: Array<string> = new Array();

  switch (expr.tag) {
    case "literal": {
      return codeGenLiteral(expr.value);
    }
    case "id": {
      let asVar = curEnv.findVar(expr.name);
      if (asVar) {
        wasms = wasms.concat(
          getPtrFromPtrPtrOffset(constant.PTR_DL, -1)
        );  // pointer to current SL 
        let iterEnv = curEnv;
        let counter = 0;
        while (!iterEnv.nameToVar.has(expr.name)) {
          counter += 1;
          iterEnv = iterEnv.parent;
          wasms = wasms.concat([`(i32.load)`])
        }
        // at SL now
        let idInfo = iterEnv.nameToVar.get(expr.name);
        wasms = wasms.concat([
          `(i32.const ${(-1 - idInfo.offset) * constant.WORD_SIZE})`,
          `(i32.add)`,
          `(i32.load)`,
        ])
        break;
      }

      let asFunc = curEnv.findFunc(expr.name);
      if (asFunc) {
        wasms = wasms.concat([
          `(i32.const ${memoryManager.functionNameToId.get(asFunc.globalName)})`,
        ])
        break;
      }

      let asClass = curEnv.findClass(expr.name);
      if (asClass) {

      }
      break;
    }
    case "unaryop": {
      let exprWASM = codeGenExpr(expr.expr);
      if (expr.op === "-") {
        wasms = wasms.concat(
          ["(i32.const 0)"],
          exprWASM,
          ["(i32.sub)"]
        )
      } else if (expr.op === "not") {
        wasms = wasms.concat(
          ["(i32.const 1)"],
          exprWASM,
          ["(i32.xor)"]
        )
      }
      break;
    }
    case "binaryop": {
      const expr1Stmts = codeGenExpr(expr.expr1);
      const expr2Stmts = codeGenExpr(expr.expr2);
      wasms = wasms.concat(
        expr1Stmts,
        expr2Stmts,
        binaryOpToWASM.get(expr.op),
      )
      break;
    }
    case "member": {
      let ownerWASM = codeGenExpr(expr.owner);
      let ownerType = expr.owner.type;
      if (ownerType.attributes.has(expr.property)) {
        wasms = wasms.concat(
          storeTempValueWithExpr(constant.PTR_T1, ownerWASM),  // load owner ptr

          loadTempValue(constant.PTR_T1),
          codeGenNoneAbort(),

          loadTempValue(constant.PTR_T1),
          [
            `(i32.const ${(
            ownerType.headerSize + 
            ownerType.attributes.get(expr.property).offset) * constant.WORD_SIZE})`,
            `(i32.add)`,
            `(i32.load)`
          ],
        );
      } else if (ownerType.methods.has(expr.property)) {
        wasms = wasms.concat(
          storeTempValueWithExpr(constant.PTR_T1, ownerWASM),  // load owner ptr

          loadTempValue(constant.PTR_T1),
          codeGenNoneAbort(),

          loadTempValue(constant.PTR_T1),
          getMethodFromPtr(ownerType, expr.property),
        );
      }
      break;
    }
    case "call": {
      if (expr.caller.tag !== "member" && expr.caller.tag !== "id") {
        break;
      }

      let pushArgsExpr: Array<string> = new Array();
      let isMemberFunc = true;

      if (expr.caller.classType) {
        let ct = expr.caller.classType;
        if (!ct.methods.has("__init__")) {
          // ptr on stack, no acti
          return codeGenAlloc(ct);
        } else {
          let funcEnv = envManager.envMap.get(`${ct.globalName}#__init__`);
          pushArgsExpr = codeGenFillParam(funcEnv, expr.args, true);
          wasms = wasms.concat(
            storeTempValueWithExpr(constant.PTR_T1, codeGenAlloc(ct)),

            loadTempValue(constant.PTR_T1),  // need an extra ptr as result

            loadTempValue(constant.PTR_T1),
            getMethodFromPtr(ct, "__init__"),
            
            codeGenCallerInit(pushArgsExpr),
            [`(call_indirect (type ${constant.WASM_FUNC_TYPE}))`],
            [`(drop)`], 
            [`;; caller destroy`],
            codeGenCallerDestroy(),
          );
          return wasms;
        }
      }

      let ft = expr.caller.funcType;
      let funcEnv = envManager.envMap.get(ft.globalName);
      isMemberFunc = ft.isMemberFunc;

      pushArgsExpr = codeGenFillParam(funcEnv, expr.args, ft.isMemberFunc);
      
      wasms = wasms.concat(
        codeGenExpr(expr.caller),
      );

      wasms = wasms.concat(
        codeGenCallerInit(pushArgsExpr),
        [`(call_indirect (type ${constant.WASM_FUNC_TYPE}))`],
        [`;; caller destroy`],
        codeGenCallerDestroy(),
      );
      
      break;
    }
  }
  return wasms;
}

function codeGenFillParam(funcEnv: Env, args: Array<Expr>, isMemberFunc: boolean): Array<string> {
  let pushArgsExpr: Array<string> = new Array();
  let paramSize = args.length;
  let offset = isMemberFunc ? 1 : 0;

  if (isMemberFunc) {
    pushArgsExpr = pushArgsExpr.concat(
      [`;; push self`],
      setValWithPtrPtrOffsetExpr(constant.PTR_SP, -1, loadTempValue(constant.PTR_T1)),
    )
  }

  funcEnv.nameToVar.forEach((variable, name) => {
    if (variable.offset < paramSize + offset) {
      if (isMemberFunc && variable.offset === 0) {
        return;
      }
      pushArgsExpr = pushArgsExpr.concat(
        setValWithPtrPtrOffsetExpr(constant.PTR_SP, -1-variable.offset, codeGenExpr(args[variable.offset - offset])),
      )
    }
  });
  pushArgsExpr = pushArgsExpr.concat(
    setPtrWithPtrPtrOffset(constant.PTR_SP, -paramSize-offset),
  );
  return pushArgsExpr;
}

function codeGenNoneAbort(): Array<string> {
  let wasms: Array<string> = new Array();
  // ptr should be on stack

  wasms = wasms.concat(
    [
      `(i32.eqz)`,
      `(if (then`,
      `(call $$noneabort)`,
      `))`
    ]
  )
  return wasms;
}

function codeGenStmt(s: Stmt): Array<string> {
  let wasms: Array<string> = new Array();
  switch (s.tag) {
    case "assign": {
      wasms = wasms.concat(
        codeGenExpr(s.name).slice(0, -1),
        codeGenExpr(s.value),
        [`(i32.store)`],
      );
      break;
    }
    case "expr": {
      wasms = wasms.concat(
        codeGenExpr(s.expr),
      );
      wasms = wasms.concat(
        [`(local.set $$last)`]
      )
      break;
    }
    case "if": {
      if (s.exprs.length === 0) {
        if (s.blocks.length === 1) {
          s.blocks[0].forEach(stmt => {
            wasms = wasms.concat(codeGenStmt(stmt));
          })
        }
        return wasms;
      }
      wasms = wasms.concat(
        codeGenExpr(s.exprs[0]),
        [`(if`],
        [`(then`]
      );

      s.blocks[0].forEach(stmt => {
        wasms = wasms.concat(codeGenStmt(stmt));
      })

      if (s.exprs.length !== s.blocks.length) {
        s.exprs.shift();
        s.blocks.shift();
        
        wasms = wasms.concat(
          [`)\n(else`],
          codeGenStmt(s),
        );
      }

      wasms = wasms.concat([`)\n)`]);
      break;
    }
    case "pass": {
      break;
    }
    case "return": {
      if (s.expr.tag === "literal" && s.expr.value.tag === "None") {
        break;
      }
      wasms = wasms.concat(
        codeGenExpr(s.expr),
        [`(local.set $$last)`, `(br $$func_block)`],
      );
      break;
    }
    case "while": {
      wasms = wasms.concat(
        [`(block \n(loop`],
        codeGenExpr(s.expr),
        [`(i32.const 1)`, `(i32.xor)`, `(br_if 1)`],
      )
      s.stmts.forEach(stmt => {
        wasms = wasms.concat(codeGenStmt(stmt));
      });
      wasms = wasms.concat(
        [`(br 0)\n)\n)`]
      )
      break;
    }
    case "print": {
      wasms = wasms.concat(
        codeGenExpr(s.expr),
      );
      
      let exprTypeName = s.expr.type.getName();
      if (exprTypeName === "int") {
        wasms = wasms.concat([`call $print#int`]);
      } else if (exprTypeName === "bool") {
        wasms = wasms.concat([`call $print#bool`]);
      } else {
        wasms = wasms.concat([`call $print#object`]);
      }
      wasms = wasms.concat([`(local.set $$last)`]);
      return wasms;
    }
  }
  return wasms;
}

function codeGenVarDef(vd: VarDef): Array<string> {
  let wasms: Array<string> = new Array();
  let varVal = curEnv.nameToVar.get(vd.tvar.name);
  
  wasms = wasms.concat(
    setValWithPtrPtrOffset(constant.PTR_DL, -2-varVal.offset, literalToVal(vd.value)),
    setPtrWithPtrPtrOffset(constant.PTR_SP, -1),
  )

  return wasms;
}

function codeGenFuncDef(fd: FuncDef): Array<string> {
  let wasms: Array<string> = new Array();

  let ft = curEnv.nameToFunc.get(fd.name);
  curEnv = curEnv.nameToChildEnv.get(fd.name);

  wasms = wasms.concat(
    [
      `(func ${ft.globalName} (result i32)`,
      `(local $$last i32)`,
      `(block $$func_block`
    ],
  )

  for (const varDef of fd.body.defs.varDefs) {
    wasms = wasms.concat(codeGenVarDef(varDef));
  }

  for (const stmt of fd.body.stmts) {
    wasms = wasms.concat(codeGenStmt(stmt));
  }
  if (ft.returnType.getName() === "<None>") {
    wasms = wasms.concat([
      `(i32.const 0)`,
      `(local.set $$last)`
    ]);
  }

  wasms = wasms.concat([
    `)`,
    `(local.get $$last)`,
    `)`
  ]);

  for (const funcDef of fd.body.defs.funcDefs) {
    wasms = wasms.concat(codeGenFuncDef(funcDef));
  }
  
  curEnv = curEnv.parent;
  return wasms;
}

function codeGenMethodDef(fd: FuncDef, ft: FuncType): Array<string> {
  let wasms: Array<string> = new Array();

  curEnv = curEnv.nameToChildEnv.get(ft.getName());
  wasms = wasms.concat(
    [
      `(func ${ft.globalName} (result i32)`,
      `(local $$last i32)`,
      `(block $$func_block`
    ],
  )

  for (const varDef of fd.body.defs.varDefs) {
    wasms = wasms.concat(codeGenVarDef(varDef));
  }

  for (const stmt of fd.body.stmts) {
    wasms = wasms.concat(codeGenStmt(stmt));
  }

  if (ft.returnType.getName() === "<None>") {
    wasms = wasms.concat([
      `(i32.const 0)`,
      `(local.set $$last)`
    ]);
  }

  wasms = wasms.concat([
    `)`,
    `(local.get $$last)`,
    `)`
  ]);

  curEnv = curEnv.parent;
  return wasms;
}

function codeGenClassDef(cd: ClassDef): [Array<string>, Array<string>] {
  let wasms: Array<string> = new Array();

  let classType = curEnv.nameToClass.get(cd.name);

  console.log(memoryManager);
  // allocate dispatch table
  classType.methodPtrs.forEach((offset, name) => {
    let ft = classType.methods.get(name);
    wasms = wasms.concat(
      setValWithPtr(
        constant.PTR_DTABLE + classType.methodPtrsHead + classType.methodPtrs.get(name),
        memoryManager.functionNameToId.get(ft.globalName)
      )
    )
  });

  let methodWASM: Array<string> = new Array();
  for (const method of cd.defs.funcDefs) {
    methodWASM = methodWASM.concat(codeGenMethodDef(method, classType.methods.get(method.name)));
  }
  return [wasms, methodWASM];
}

function codeGenProgram(p: Program): Array<Array<string>> {
  let varWASM: Array<string> = new Array();
  for (const varDef of p.defs.varDefs) {
    varWASM = varWASM.concat(codeGenVarDef(varDef));
  }

  let classWASM: Array<string> = new Array();
  let methodWASM: Array<string> = new Array();
  for (const classDef of p.defs.classDefs) {
    let [cwasm, mwasm] = codeGenClassDef(classDef);
    classWASM = classWASM.concat(cwasm);
    methodWASM = methodWASM.concat(mwasm);
  }

  for (const funcDef of p.defs.funcDefs) {
    methodWASM = methodWASM.concat(codeGenFuncDef(funcDef));
  }

  let stmtsWASM: Array<string> = new Array();
  
  for (const stmt of p.stmts) {
    stmtsWASM = stmtsWASM.concat(
      codeGenStmt(stmt)
    )
  }

  return [varWASM, classWASM, methodWASM, stmtsWASM];
}

type CompileResult = {
  wasmSource: string,
};

export function compile(source: string, importObject: any, gm: MemoryManager, em: EnvManager): CompileResult {
  memoryManager = gm;
  envManager = em;
  curEnv = em.getGlobalEnv();

  const ast = parse(source);
  console.log(ast);
  tcProgram(ast, gm, em);
  console.log(curEnv);

  importObject.js = {mem: memoryManager.memory}
  importObject.imports = {
    print_obj: (ptr: number) => {
      importObject.builtin.print(-1, ptr);
      return 0;
    },

    print_int: (val: number) => {
      importObject.builtin.print(2, val);
      return 0;
    },

    print_bool: (val: number) => {
      importObject.builtin.print(1, val);
      return 0;
    },

    print_debug: (val: number) => {
      console.log(`Debugging: ${val}`);
      return val;
    },

    none_abort: () => {
      throw new Error("none ptr");
    },
  }

  let memorySizeByte = importObject.js.mem.buffer.byteLength;

  const wasms = codeGenProgram(ast);
  let returnType = "";
  let returnExpr = "";
  let scratchVar = "(local $$last i32)";

  let initWASM: Array<string> = new Array();
  if (!memoryManager.initialized) {
    initWASM = initWASM.concat(
      setPtrWithPtrPtrOffset(constant.PTR_EP, constant.PTR_HEAP),
      setPtrWithPtrPtrOffset(constant.PTR_SP, memorySizeByte / 4 - 2),
      setPtrWithPtrPtrOffset(constant.PTR_DL, memorySizeByte / 4 - 1),
      setValWithPtrPtrOffsetExpr(constant.PTR_SP, 0, getPtrFromPtrPtr(constant.PTR_SP)),
    );
    memoryManager.initialized = true;
  }

  memoryManager.functionSource += "\n" + wasms[2].join("\n");

  const wasmSource = `(module
    (import "js" "mem" (memory ${constant.MEM_SIZE}))  ;; memory with one page(64KB)
    (func $print#int (import "imports" "print_int") (param i32) (result i32))
    (func $print#bool (import "imports" "print_bool") (param i32) (result i32))
    (func $print#object (import "imports" "print_obj") (param i32) (result i32))
    (func $print#debug (import "imports" "print_debug") (param i32) (result i32))
    (func $$noneabort (import "imports" "none_abort"))
    
    ;; function table
    (table ${constant.MAX_FUNC_SUPPORT} anyfunc)
    (type ${constant.WASM_FUNC_TYPE} (func (result i32)))
    ${memoryManager.functionSource}
    (elem (i32.const 0) ${memoryManager.functionIdToName.join(" ")})

    (func (export "exported_func") ${returnType}
      ${scratchVar}
      ${initWASM.join("\n")}
      ;; class def
      ${wasms[1].join("\n")}
      ;; var def
      ${wasms[0].join("\n")}
      ;; stmts
      ${wasms[3].join("\n")}
      ${returnExpr}
    )
  )`;

  console.log(wasmSource);
  return {
    wasmSource,
  };
}
