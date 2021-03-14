import { ClassDef, ClassType, Expr, FuncDef, FuncType, Literal, Program, Stmt, Value, VarDef } from "./ast";
import { Env, EnvManager } from "./env";
import { MemoryManager } from "./memory";
import { parse } from "./parser";
import { isBasicType, tcProgram } from "./typechecker";
import * as constant from "./constant"
import { off } from "node:process";

let memoryManager: MemoryManager;
let envManager: EnvManager;
let curEnv: Env;

function numberPtrToExprPtr(p: number): Array<string> {
  return [`(i32.const ${p * constant.WORD_SIZE})`]
}

function valueToExpr(v: number): Array<string> {
  return [`(i32.const ${v})`]
}

function resolveExprPtr(expr: Array<string>): Array<string> {
  // returns *p
  let wasms: Array<string> = new Array()
  wasms = wasms.concat(
    expr,
    [`(i32.load)`]
  )
  return wasms
}

function resolveNumberPtr(p: number): Array<string> {
  // returns *p
  return resolveExprPtr(numberPtrToExprPtr(p))
}

function resolveExprPtrThenOffset(expr: Array<string>, offset: number): Array<string> {
  // returns *pp + offset
  let wasms: Array<string> = new Array()
  wasms = wasms.concat(
    expr,
    [`(i32.load)`],
    numberPtrToExprPtr(offset),
    [`(i32.add)`],
  )
  return wasms
}

function resolveNumberPtrThenOffset(p: number, offset: number): Array<string> {
  // returns *p + offset
  return resolveExprPtrThenOffset(numberPtrToExprPtr(p), offset)
}

function storeExprWithExprPtr(p: Array<string>, expr: Array<string>): Array<string> {
  // *pp = expr
  let wasms: Array<string> = new Array();
  wasms = wasms.concat(
    p,
    expr,
    [`(i32.store)`]
  )
  return wasms;
}

function storeExprWithNumberPtr(p: number, expr: Array<string>): Array<string> {
  // *p = expr
  return storeExprWithExprPtr(numberPtrToExprPtr(p), expr)
}

function storeValWithExprPtr(p: number, value: number): Array<string> {
  // *p = value
  return storeExprWithExprPtr(numberPtrToExprPtr(p), valueToExpr(value));
}

function storeValWithNumberPtr(p: number, value: number): Array<string> {
  // *p = value
  return storeExprWithNumberPtr(p, valueToExpr(value));
}

function storeExprWithNumberPtrThenOffset(pp: number, offset: number, expr: Array<string>): Array<string> {
  // *(*pp + offset) = expr
  return storeExprWithExprPtr(resolveNumberPtrThenOffset(pp, offset), expr)
}

function storeValWithNumberPtrThenOffset(pp: number, offset: number, value: number): Array<string> {
  // *(*pp + offset) = value
  return storeExprWithNumberPtrThenOffset(pp, offset, valueToExpr(value));
}

function updatePtrContentByOffset(pp: number, offset: number): Array<string> {
  // *pp = *pp + offset
  return storeExprWithNumberPtr(pp, resolveNumberPtrThenOffset(pp, offset));
}

function storeTempExprWithNumberPtr(p: number, expr: Array<string>): Array<string> {
  // *p = expr
  return storeExprWithNumberPtr(p, expr);
}

function resolveTempNumberPtr(p: number): Array<string> {
  // *p
  return resolveNumberPtr(p);
}

function findVarPosition(name: string): Array<string> {
  let iterEnv = curEnv;
  let wasms: Array<string> = new Array();
  wasms = wasms.concat(
    resolveNumberPtrThenOffset(constant.PTR_DL, -1),
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

function getMethodWithName(ct: ClassType, methodName: string): Array<string> {
  return [].concat(
    numberPtrToExprPtr(ct.methodPtrSectionHead + ct.methodPtrs.get(methodName)),
    [`(i32.add)`,
    `(i32.load)`],
  )
}

/*
function getAttributeFromPtr(ct: ClassType, attrName: string): Array<string> {
  return [
    `(i32.const ${(
    ct.headerSize + ct.attributes.get(attrName).offset) * constant.WORD_SIZE})`,
    `(i32.add)`,
    `(i32.load)`
  ];
}
*/

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

function codeGenCallerInit(): Array<string> {
  let wasms: Array<string> = new Array();
  wasms = wasms.concat(
    [`;; callerInit`],
    storeExprWithNumberPtrThenOffset(constant.PTR_SP, -1, resolveNumberPtr(constant.PTR_DL)),
    storeExprWithNumberPtrThenOffset(constant.PTR_SP, -2, resolveNumberPtrThenOffset(constant.PTR_DL, -1)),
    storeTempExprWithNumberPtr(constant.PTR_T2, resolveNumberPtrThenOffset(constant.PTR_SP, -1)),  // store new DL
    updatePtrContentByOffset(constant.PTR_SP, -2),
    storeExprWithNumberPtr(constant.PTR_DL, resolveTempNumberPtr(constant.PTR_T2)),
    [`;; callerInit done`],
  )
  return wasms;
}

function codeGenCallerDestroy(): Array<string> {
  let wasms: Array<string> = new Array();
  let loadDL: Array<string> = new Array();
  wasms.push(`;; callerDestroy`)
  loadDL = loadDL.concat(
    resolveNumberPtr(constant.PTR_DL),
    [`(i32.load)`]
  )

  wasms = wasms.concat(
    storeExprWithNumberPtr(constant.PTR_SP, resolveNumberPtrThenOffset(constant.PTR_DL, 1)),
    storeExprWithNumberPtr(constant.PTR_DL, loadDL),
  )
  wasms.push(`;; callerDestroy done`)
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

function findTypeCastOffset(lct:ClassType, rct:ClassType): number {
  let t: ClassType = rct;
  if (lct.hasDescendant(rct)) {
    let offset = 0;
    while (t.getName()!=lct.getName()) {
      offset = offset + t.headerSize
      t = t.parent
    }
    return offset
  }
  else {
    return -findTypeCastOffset(rct, lct)
  }
}

function codeGenClassTypeCastByAddingOffset(lct:ClassType, rct:ClassType): Array<string> {
  let wasms: Array<string> = new Array();
  wasms = wasms.concat(
    [`;; typecast by adding offset`],
    numberPtrToExprPtr(findTypeCastOffset(lct, rct)),
    [`(i32.add)`]
  )
  return wasms
}

function codeGenClassTypeCastByLoadingOffset(offsetToHead: number): Array<string> {
  let wasms: Array<string> = new Array();
  wasms = wasms.concat(
    [`;; typecast by loading offset`],
    [`(local.set $$duplicator)`,
    `(local.get $$duplicator)`,
    `(local.get $$duplicator)`],
    numberPtrToExprPtr(offsetToHead),
    [`(i32.add)`,
    `(i32.load)`,
    `(i32.add)`]
  )
  return wasms
}

function codeGenAllocBase(ct: ClassType, dct:ClassType, epOffset: number): Array<string> {
  let wasms: Array<string> = new Array();
  wasms = wasms.concat(
    [`;; AllocBase for class ${ct.getName()}`],
    // *(*pp + offset) = value
    storeValWithNumberPtrThenOffset(constant.PTR_EP, 0+epOffset, -1),  // tag
    storeValWithNumberPtrThenOffset(constant.PTR_EP, 1+epOffset, ct.size),  // size
    storeExprWithNumberPtrThenOffset(constant.PTR_EP, 2+epOffset, numberPtrToExprPtr(ct.dispatchTablePtr + constant.PTR_DTABLE)),
  )
  if (ct.parent.getName()!='object') {
    wasms = wasms.concat(
      [`;; Call AllocBase for parent class:${ct.parent.globalName}`],
      codeGenAllocBase(ct.parent, dct, epOffset + ct.headerSize)
    )
  }
  // alloc attr_ptrs
  wasms = wasms.concat([`;; AllocBase class ${ct.getName()} attr_ptrs`])
  ct.attributes.forEach(attr => {
    console.log(`ct name: ${ct.globalName}, dct name: ${dct.globalName}, finding attr ${attr.name}, offset= ${ct.attributePtrSectionHead} + ${attr.offset} + ${epOffset}`)
    const attrPtrDestExpr = resolveNumberPtrThenOffset(constant.PTR_EP, dct.attributeSectionHead + dct.attributes.get(attr.name).offset)
    wasms = wasms.concat(
      storeExprWithNumberPtrThenOffset(constant.PTR_EP, ct.attributePtrSectionHead + attr.offset + epOffset, attrPtrDestExpr)
    );
  });
  // alloc func_ptrs
  wasms = wasms.concat([`;; AllocBase class ${ct.getName()} method_ptrs`])
  ct.methodPtrs.forEach((offset, name) => {
    const dispatchTablePtrExpr = resolveNumberPtrThenOffset(constant.PTR_EP, dct.getDispatchTablePtrOffset())
    const methodPtrDestExpr = resolveExprPtr(resolveExprPtrThenOffset(dispatchTablePtrExpr, dct.methodPtrs.get(name)))
    wasms = wasms.concat(
      storeExprWithNumberPtrThenOffset(constant.PTR_EP, ct.methodPtrSectionHead + offset + epOffset, methodPtrDestExpr)
    )
  })
  // alloc func_ptr_offsets
  ///*
  wasms = wasms.concat([`;; AllocBase class ${ct.getName()} method_ptr_offsets`])
  ct.methodPtrs.forEach((offset, name) => {
    const methodPtrOffsetExpr = numberPtrToExprPtr(findTypeCastOffset(dct.methods.get(name).paramsType[0], ct))
    wasms = wasms.concat(
      storeExprWithNumberPtrThenOffset(constant.PTR_EP, ct.methodPtrOffsetSectionHead + offset + epOffset, methodPtrOffsetExpr)
    )
  })
  //*/
  wasms = wasms.concat([`;; AllocBase class ${ct.getName()} done`])
  return wasms
}

function codeGenAlloc(ct: ClassType): Array<string> {
  let wasms: Array<string> = new Array();
  wasms.push(`;; Alloc class ${ct.getName()}`)
  wasms = wasms.concat(
    [`;; Allocating parent class:${ct.parent.globalName}`],
    codeGenAllocBase(ct, ct, 0)
  )
  wasms.push(`;; Alloc class ${ct.getName()} data section`)
  ct.attributes.forEach(attr => {
    wasms.push(`;; head=${ct.attributeSectionHead}, offset=${attr.offset}`)
    wasms = wasms.concat(storeValWithNumberPtrThenOffset(constant.PTR_EP, ct.attributeSectionHead+attr.offset, literalToVal(attr.value)))
  })
  wasms.push(`;; Alloc class update ep`)
  wasms = wasms.concat(
    resolveNumberPtr(constant.PTR_EP),  // leave a ptr as result
    updatePtrContentByOffset(constant.PTR_EP, ct.size),  // update EP
  )
  wasms.push(`;; Alloc class ${ct.getName()} done`)
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
          resolveNumberPtrThenOffset(constant.PTR_DL, -1)
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
          storeTempExprWithNumberPtr(constant.PTR_T1, ownerWASM),  // load owner ptr

          resolveTempNumberPtr(constant.PTR_T1),
          codeGenNoneAbort(),

          resolveTempNumberPtr(constant.PTR_T1),
          [
            `(i32.const ${(
            ownerType.attributePtrSectionHead + 
            ownerType.attributes.get(expr.property).offset) * constant.WORD_SIZE})`,
            `(i32.add)`,
            `(i32.load)`,
            `(i32.load)`
          ],
        );
      } else if (ownerType.methods.has(expr.property)) {
        wasms = wasms.concat(
          storeTempExprWithNumberPtr(constant.PTR_T1, ownerWASM),  // load owner ptr

          resolveTempNumberPtr(constant.PTR_T1),
          codeGenNoneAbort(),

          resolveTempNumberPtr(constant.PTR_T1),
          getMethodWithName(ownerType, expr.property),
        );
      }
      break;
    }
    case "call": {
      if (expr.caller.tag !== "member" && expr.caller.tag !== "id") {
        break;
      }

      let pushArgsExpr: Array<string> = new Array();
      let fillArgsExpr: Array<string> = new Array();

      if (expr.caller.classType) {
        let ct = expr.caller.classType;
        if (!ct.methods.has("__init__")) {
          // ptr on stack, no acti
          return codeGenAlloc(ct);
        } else {
          console.log(`has custom init`)
          console.log(`has ${expr.args.length} args`)
          const initfunc = ct.methods.get("__init__")
          console.log(`initfunc globalname: ${initfunc.globalName}`)
          console.log(`${initfunc.paramsType[0].globalName}`)
          initfunc.paramsType.forEach(pt => {
            console.log(`arg type: ${pt.getName()}`)
          })
          const funcType = ct.methods.get("__init__")
          let funcEnv = envManager.envMap.get(funcType.globalName);
          let funcOffset = ct.methodPtrs.get(funcType.getPureName())
          console.log(`ClassInit funcType name: ${funcType.getName()}`)
          console.log(`ClassInit ct methods:`)
          ct.methodPtrs.forEach((offset, name) => {
            console.log(`method: ${name}, offset: ${offset}`)
          })
          console.log(`ClassInit codeGenPushParam called: funcOffset: ${funcOffset}`)
          pushArgsExpr = codeGenPushParam(funcEnv, expr.args, true, ct, funcOffset);
          fillArgsExpr = codeGenFillParam(expr.args.length+1);
          wasms = wasms.concat(
            [`;; class init: Alloc`],
            storeTempExprWithNumberPtr(constant.PTR_T1, codeGenAlloc(ct)),

            [`;; class init: push addr for return`],
            resolveTempNumberPtr(constant.PTR_T1),  // need an extra ptr as result

            [`;; class init: push addr for __init__`],
            resolveTempNumberPtr(constant.PTR_T1),
            [`;; class init: getMethodWithName`],
            getMethodWithName(ct, "__init__"),

            [`;; class init: call __init__`],
            [`;; class init: push args`],
            pushArgsExpr,
            codeGenCallerInit(),
            [`;; class init: fill args`],
            fillArgsExpr,
            
            [`(call_indirect (type ${constant.WASM_FUNC_TYPE}))`],
            [`(drop)`], 
            [`;; caller destroy`],
            codeGenCallerDestroy(),
          );
          return wasms;
        }
      }

      wasms = wasms.concat(
        codeGenExpr(expr.caller),
      );

      let ft = expr.caller.funcType;
      let funcEnv = envManager.envMap.get(ft.globalName);

      console.log(`caller type`, expr.caller.tag)
      if (ft.isMemberFunc) {
        if (expr.caller.tag != 'member') {
          throw new Error(`This should not happen: calling a member function while isMemberFunc is false`)
        }
        const ownerType = expr.caller.owner.type
        let funcOffset = ownerType.methodPtrs.get(ft.getPureName())
        console.log(`MemberFunc call pushparam, offset: ${funcOffset}`)
        pushArgsExpr = codeGenPushParam(funcEnv, expr.args, true, ownerType, funcOffset)
      }
      else {
        console.log(`NonMemberFunc call pushparam, offset: 0`)
        pushArgsExpr = codeGenPushParam(funcEnv, expr.args, false, null, 0);
      }
      fillArgsExpr = codeGenFillParam(expr.args.length + (ft.isMemberFunc ? 1 : 0));


      wasms = wasms.concat(
        pushArgsExpr,
        codeGenCallerInit(),
        fillArgsExpr,
        [`(call_indirect (type ${constant.WASM_FUNC_TYPE}))`],
        [`;; caller destroy`],
        codeGenCallerDestroy(),
      );
      
      break;
    }
  }
  return wasms;
}

function codeGenPushParam(funcEnv: Env, args: Array<Expr>, isMemberFunc: boolean, selfType: ClassType, funcOffset: number): Array<string> {
  let pushArgsExpr: Array<string> = new Array();
  let paramSize = args.length;
  let offset = isMemberFunc ? 1 : 0;

  funcEnv.nameToVar.forEach((variable, name) => {
    if (variable.offset < paramSize + offset) {
      if (isMemberFunc && variable.offset === 0) {
        console.log(`self typeCast check: ${variable.type.getName()}, ${selfType.getName()}, offset: ${funcOffset}`)
        pushArgsExpr = pushArgsExpr.concat(
          resolveNumberPtrThenOffset(constant.PTR_SP, -3),
          [`;; self typeCast: ${variable.type.getName()}, ${selfType.getName()}`,],
          resolveTempNumberPtr(constant.PTR_T1),
          codeGenClassTypeCastByLoadingOffset(selfType.methodPtrOffsetSectionHead + funcOffset),
          [`;; self typeCast done`,],
        )
        return;
      }
      pushArgsExpr = pushArgsExpr.concat(
        resolveNumberPtrThenOffset(constant.PTR_SP, -3-variable.offset),
        appendImplicitCastCode(variable.type, args[variable.offset - offset].type, codeGenExpr(args[variable.offset - offset])),
      )
    }
  });
  return pushArgsExpr;
}

function codeGenFillParam(numArgs: number): Array<string> {
  let pushArgsExpr: Array<string> = new Array();
  for (let i = 0; i < numArgs; i++) {
    pushArgsExpr = pushArgsExpr.concat([(`(i32.store)`)]);
  }
  pushArgsExpr = pushArgsExpr.concat(
    updatePtrContentByOffset(constant.PTR_SP, -numArgs),
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

function appendImplicitCastCode(lValueType: ClassType, rValueType: ClassType, rValueCode: Array<string>): Array<string> {
  console.log(`checking implicit cast: lt:${lValueType.getName()},  ${rValueType.getName()}`)
  if (rValueType.getName()=='<None>')
    return rValueCode
  if (lValueType.getName()!=rValueType.getName() && !isBasicType(lValueType)) {
    console.log(`classTypeCast triggered: ${rValueType.getName()} to ${lValueType.getName()}`)
    rValueCode = rValueCode.concat(codeGenClassTypeCastByAddingOffset(lValueType, rValueType))
  }
  return rValueCode
}

function codeGenStmt(s: Stmt): Array<string> {
  let wasms: Array<string> = new Array();
  wasms.push(`;; code for ${s.tag} stmt`)
  switch (s.tag) {
    case "assign": {
      wasms = wasms.concat(
        [`;; assignStmt lvalue begin`],
        codeGenExpr(s.name).slice(0, -1),
        [`;; assignStmt lvalue end, rvalue begin`],
        appendImplicitCastCode(s.name.type, s.value.type, codeGenExpr(s.value)),
        [`;; assignStmt rvalue end, store only`],
        [`(i32.store)`],
        [`;; assignStmt end`],
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
        appendImplicitCastCode(s.targetType, s.expr.type, codeGenExpr(s.expr)),
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
    storeValWithNumberPtrThenOffset(constant.PTR_DL, -2-varVal.offset, literalToVal(vd.value)),
    updatePtrContentByOffset(constant.PTR_SP, -1),
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
      `(local $$duplicator i32)`,
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
      `(local $$duplicator i32)`,
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
  wasms.push(`;; codeGenClassDef ${cd.name}`)
  let classType = curEnv.nameToClass.get(cd.name);

  console.log(memoryManager);
  // allocate dispatch table
  classType.methodPtrs.forEach((offset, name) => {
    let ft = classType.methods.get(name);
    console.log(`class ${cd.name} dispatchTable: method: ${ft.getName()}, idx: ${memoryManager.functionNameToId.get(ft.globalName)}`)
    wasms = wasms.concat(
      storeValWithNumberPtr(
        constant.PTR_DTABLE + classType.dispatchTablePtr + classType.methodPtrs.get(name),
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
  resultValue: Value,
};

export function compile(source: string, importObject: any, gm: MemoryManager, em: EnvManager): CompileResult {
  memoryManager = gm;
  envManager = em;
  curEnv = em.getGlobalEnv();

  const ast = parse(source);
  console.log(ast);
  tcProgram(ast, gm, em);
  console.log(curEnv);

  let resultValue:Value;
  if (ast.stmts.length > 0) {
    let resultType = ast.stmts[ast.stmts.length-1].type;
    if (!resultType) {
      resultValue = {tag: "none"};
    } else if (resultType.getName() === "int") {
      resultValue = {tag: "num", value: 0};
    } else if (resultType.getName() === "bool") {
      resultValue = {tag: "bool", value: false};
    } else if (resultType.getName() === "<None>") {
      resultValue = {tag: "none"};
    } else {
      resultValue = {tag: "object", name: resultType.getName(), address: 0};
    }
  } else {
    resultValue = {tag: "none"};
  }

  importObject.js = {mem: memoryManager.memory}
  importObject.builtin = {
    print_obj: (ptr: number) => {
      if (ptr === 0) {
        importObject.imports.print_none(ptr);
      } else {
        importObject.imports.print_obj(ptr);
      }
      
      return 0;
    },

    print_int: (val: number) => {
      importObject.imports.print_num(val);
      return 0;
    },

    print_bool: (val: number) => {
      importObject.imports.print_bool(val);
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
  let scratchVar = ["(local $$last i32)", `(local $$duplicator i32)`];

  if(resultValue.tag !== "none") {
    returnType = "(result i32)";
    returnExpr = "(local.get $$last)"
  } 

  let initWASM: Array<string> = new Array();
  if (!memoryManager.initialized) {
    initWASM = initWASM.concat(
      updatePtrContentByOffset(constant.PTR_EP, constant.PTR_HEAP),
      updatePtrContentByOffset(constant.PTR_SP, memorySizeByte / 4 - 2),
      updatePtrContentByOffset(constant.PTR_DL, memorySizeByte / 4 - 1),
      storeExprWithNumberPtrThenOffset(constant.PTR_SP, 0, resolveNumberPtr(constant.PTR_SP)),
    );
    memoryManager.initialized = true;
  }

  memoryManager.functionSource += "\n" + wasms[2].join("\n");

  const wasmSource = `(module
    (import "js" "mem" (memory ${constant.MEM_SIZE}))  ;; memory with one page(64KB)
    (func $print#int (import "builtin" "print_int") (param i32) (result i32))
    (func $print#bool (import "builtin" "print_bool") (param i32) (result i32))
    (func $print#object (import "builtin" "print_obj") (param i32) (result i32))
    (func $print#debug (import "builtin" "print_debug") (param i32) (result i32))
    (func $$noneabort (import "builtin" "none_abort"))
    
    ;; function table
    (table ${constant.MAX_FUNC_SUPPORT} anyfunc)
    (type ${constant.WASM_FUNC_TYPE} (func (result i32)))
    ${memoryManager.functionSource}
    (elem (i32.const 0) ${memoryManager.functionIdToName.join(" ")})

    (func (export "exported_func") ${returnType}
      ${scratchVar.join("\n")}
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
    resultValue
  };
}
