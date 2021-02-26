import { Expr, FuncBody, FuncDef, PreDef, Program, Stmt, TypedVar, VarDef, Literal, VarName, ClassType, FuncType, ClassDef, Variable } from "./ast";
import { Env, EnvManager } from "./env";
import { MemoryManager } from "./memory";

export type TypedExpr = {
  expr: Expr,
  type: ClassType,
}

const binaryOpToMethod: Map<string,string> = new Map([
  ["+", "__add__"],
  ["-", "__sub__"],
  ["*", "__mul__"],
  ["//", "__divn__"],
  ["%", "__mod__"],
  ["==", "__eq__"],
  ["!=", "__neq__"],
  ["<=", "__le__"],
  [">=", "__ge__"],
  ["<", "__lt__"],
  [">", "__gt__"],
  ["is", "__is__"],
  ["and", "__and__"],
  ["or", "__or__"],
])

const unaryOpToMethod: Map<string,string> = new Map([
  ["-", "__neg__"],
  ["not", "__not__"],
])

export function typeMatching(t: Array<ClassType>, target: Array<ClassType>): boolean {
  if (t.length != target.length) {
    return false;
  }
  for (let i = 0; i < t.length; i++) {
    if (!target[i].hasDescendant(t[i])) {
      return false;
    }
  }
  return true;
}

let curEnv: Env;
let envManager: EnvManager;
let memoryManager: MemoryManager;

// static type checker

export function tcExpr(e: Expr): Expr {
  switch (e.tag) {
    case "literal": {
      let t = tcLiteral(e.value);
      e.type = t;
      return e;
    }
    case "id": {
      let asVar = curEnv.findVar(e.name);
      if (asVar) {
        e.type = asVar.type;
        return e;
      }

      let asFunc = curEnv.findFunc(e.name);
      if (asFunc) {
        e.funcType = asFunc;
        return e;
      }

      let asClass = curEnv.findClass(e.name);
      if (asClass) {
        let initFunc = asClass.methods.get("__init__");
        console.log(initFunc);
        if (initFunc) {
          e.funcType = new FuncType(asClass.globalName + "$##init", initFunc.paramsType, asClass, true);
        } else {
          e.funcType = new FuncType(asClass.globalName + "$##init", [asClass], asClass, true);
        }
        e.classType = asClass;

        return e;
      }
      
      throw new Error(`Unknown id: ${e.name}`);
    }
    case "binaryop": {
      let t1 = tcExpr(e.expr1);
      let t2 = tcExpr(e.expr2);

      if (!t1.type || !t2.type) {
        throw new Error("Expr for binaryop should be of valid types");
      }

      if (!binaryOpToMethod.has(e.op)) {
        throw new Error("Unknown binary operation '" + e.op + "'");
      }
      
      let method = binaryOpToMethod.get(e.op);
      if (method === "__is__") {
        let t1TypeName = t1.type.getName();
        let t2TypeName = t1.type.getName();
        if (t1TypeName === "int" || t1TypeName === "bool" || t2TypeName === "int" || t2TypeName === "bool") {
          throw new Error(`Invalid type for 'is': ${t1TypeName}, ${t2TypeName}`);
        }
        e.type = envManager.classMap.get("$bool");
        return e;
      }

      if (!t1.type.methods.has(method)) {
        throw new Error("Unknown binary operation '" + e.op + "' for type " + t1.type.getName());
      }

      if (!typeMatching(t1.type.methods.get(method).paramsType.slice(1), [t2.type])) {
        let lstr = t1.type.getName();
        for (const t of t1.type.methods.get(method).paramsType) {
          lstr += "," + t.getName();
        }
        throw new Error("Expect type [" + lstr + "]" 
        + ", get ["+ t1.type.getName() + "," + t2.type.getName() + "]");
      }
      e.type = t1.type.methods.get(method).returnType;
      return e;
    }
    case "unaryop": {
      let t = tcExpr(e.expr);
      if (!unaryOpToMethod.has(e.op)) {
        throw new Error("Unknown unary operation '" + e.op + "'");
      }
      let method = unaryOpToMethod.get(e.op);
      if (!t.type.methods.has(method)) {
        throw new Error("Unknown unary operation '" + e.op + "' for type " + t.type.getName());
      }

      e.type = t.type.methods.get(method).returnType;
      return e;
    }
    case "member": {
      let owner = tcExpr(e.owner);  // expect to be a class type that has property
      let ct = owner.type;
      if (ct.attributes.has(e.property)) {
        e.type = ct.attributes.get(e.property).type;
      } else if (ct.methods.has(e.property)) {
        e.funcType = ct.methods.get(e.property);
      } else {
        throw new Error(`Unknown property for class ${owner.type.getName()}: ${e.property}`);
      }
      return e;
    }
    case "call": {
      let caller = tcExpr(e.caller);
      
      if (!(caller.tag === "id" || caller.tag === "member")) {
        throw new Error(`Unknown call`);
      }

      if (!caller.funcType) {
        throw new Error(`Unknown function`);
      }

      let ft = caller.funcType;
      let exprTypes: Array<ClassType> = [];

      for (const arg of e.args) {
        exprTypes.push(tcExpr(arg).type);
      }

      let paramsType = ft.paramsType;
      if (ft.isMemberFunc) {
        paramsType = paramsType.slice(1);
      }
      if (!typeMatching(exprTypes, paramsType)) {
        throw new Error(`Function params not match: ${ft.globalName}, expect [${
          paramsType.map((e)=>e.getName()).join(",")
        }], get [${
          exprTypes.map((e)=>e.getName()).join(",")
        }]`);
      }

      e.type = ft.returnType;
      return e;
    }
  }
}

export function tcStmt(s: Stmt) {
  switch (s.tag) {
    case "assign": {
      let assignType = tcExpr(s.value).type;
      let v = tcExpr(s.name);

      if (!v.type.hasDescendant(assignType)) {
        throw new Error(`Expect type ${v.type.getName()}, get type ${assignType.getName()}`);
      }
      return;
    }
    case "expr": {
      s.type = tcExpr(s.expr).type;
      return;
    }
    case "if": {
      s.exprs.forEach(element => {
        let te = tcExpr(element);
        if (te.type.getName() !== "bool") {
          throw new Error("Expect bool type, get type " + te.type.getName());
        }
      });
      s.blocks.forEach(stmts => {
        stmts.forEach(stmt => {
          tcStmt(stmt);
        })
      })
      return;
    }
    case "pass": {
      return;
    }
    case "return": {
      let te = tcExpr(s.expr);
      let expectedType = envManager.funcMap.get(curEnv.name).returnType;
      if (!expectedType.hasDescendant(te.type)) {
        throw new Error("Expect type " + expectedType.getName() + ", get type " + te.type.getName());
      }
      
      return;
    }
    case "while": {
      let te = tcExpr(s.expr);
      if (te.type.globalName !== "$bool") {
        throw new Error("Expect bool type, get type " + te.type.getName());
      }

      return;
    }
    case "print": {
      tcExpr(s.expr);
      return;
    }
  }
}

export function tcLiteral(l: Literal): ClassType {
  switch(l.tag) {
    case "True":
    case "False": {
      return envManager.classMap.get("$bool");
    }
    case "None": {
      return envManager.classMap.get("$<None>");
    }
    case "number": {
      return envManager.classMap.get("$int");
    }
  }
}

export function tcVarDef(vd: VarDef) {
  if (curEnv.nameToVar.has(vd.tvar.name)) {
    throw new Error("Redeclared variable " + vd.tvar.name);
  }

  let tVar = curEnv.findClass(vd.tvar.type);

  if (!tVar) {
    throw new Error("Unknown type " + vd.tvar.type);
  }

  let tVal = tcLiteral(vd.value);
  if (!tVar.hasDescendant(tVal)) {
    throw new Error("Type not match for " + tVar.getName() + " and " + tVal.getName());
  }
  
  curEnv.nameToVar.set(vd.tvar.name, {
    name: vd.tvar.name,
    type: tVar,
    value: vd.value,
    offset: curEnv.nameToVar.size,
  })
}

export function tcAllPathReturn(block: Array<Stmt>): boolean {
  for (const stmt of block) {
    if (stmt.tag === "return") {
      return true;
    }
  }

  for (const stmt of block) {
    if (stmt.tag === "if" && stmt.blocks.length > stmt.exprs.length) {
      let returned = true;
      stmt.blocks.forEach(innerBlock => {
        if (!tcAllPathReturn(innerBlock)) {
          returned = false;
        }
      })
      if (returned) {
        return true;
      }
    }
  }

  return false;
}

export function tcFuncBody(fb: FuncBody) {
  fb.defs.funcDefs.forEach(funcDef => {
    loadFuncDef(funcDef);
  });
  tcDefs(fb.defs);
  fb.stmts.forEach(stmt => {
    tcStmt(stmt);
  });
}

export function loadFuncDef(fd: FuncDef) {
  if (curEnv.isRepeat(fd.name)) {
    throw new Error(`Already defined: ${fd.name}`);
  }

  let globalName = curEnv.name + "$" + fd.name;
  let newEnv: Env = new Env(globalName, curEnv, envManager);

  let paramsType: Array<ClassType> = [];

  for (const param of fd.params) {
    let ct = curEnv.findClass(param.type);
    if (!ct) {
      throw new Error(`Unknown param type: ${param.type}`);
    }

    let v: Variable = {
      name: param.name,
      type: ct,
      value: {tag: "None"},
      offset: newEnv.nameToVar.size,
    };
    newEnv.nameToVar.set(param.name, v);
    paramsType.push(ct);
  }

  let returnType = curEnv.findClass(fd.retType);
  if (!returnType) {
    throw new Error(`Unknown return type: ${fd.retType}`);
  }

  let funcType: FuncType = new FuncType(globalName, paramsType, returnType, false);
  
  curEnv.registerFunc(fd.name, funcType, newEnv);
}

export function tcFuncDef(fd: FuncDef) {
  curEnv = curEnv.nameToChildEnv.get(fd.name);

  tcFuncBody(fd.body);
  if (fd.retType !== "<None>") {
    if (!tcAllPathReturn(fd.body.stmts)) {
      throw new Error("All path in this method should have a return statement");
    }
  }
  curEnv = curEnv.parent;

  let ft = curEnv.nameToFunc.get(fd.name);
  memoryManager.collectFunc(ft.globalName);
}

export function tcAttributesDef(ct: ClassType, vd: VarDef) {
  if (ct.attributes.has(vd.tvar.name)) {
    throw new Error(`Redeclared variable: ${vd.tvar.name}`);
  }

  let tVar = curEnv.findClass(vd.tvar.type);

  if (!tVar) {
    throw new Error(`Unknown type: ${vd.tvar.type}`);
  }

  let tVal = tcLiteral(vd.value);
  if (!tVar.hasDescendant(tVal)) {
    throw new Error("Type not match for " + tVar.getName() + " and " + tVal.getName());
  }

  let variable: Variable = {
    name: vd.tvar.name,
    type: tVar,
    value: vd.value,
    offset: ct.attributes.size,
  }
  
  ct.attributes.set(variable.name, variable);
}

export function loadMethodDef(ct: ClassType, fd: FuncDef) {
  let globalName = `${curEnv.name}$${ct.getName()}#${fd.name}`;
  let newEnv: Env = new Env(globalName, curEnv, envManager);

  let paramsType: Array<ClassType> = [];

  fd.params.forEach((param, i) => {
    let ct = curEnv.findClass(param.type);
    if (!ct) {
      throw new Error(`Unknown param type: ${param.type}`);
    }

    let v: Variable = {
      name: param.name,
      type: ct,
      value: {tag: "None"},
      offset: i,
    };
    newEnv.nameToVar.set(param.name, v);
    paramsType.push(ct);
  });

  let returnType = curEnv.findClass(fd.retType);
  if (!returnType) {
    throw new Error(`Unknown return type: ${fd.retType}`);
  }

  let funcType: FuncType = new FuncType(globalName, paramsType, returnType, true);
  
  curEnv.registerFunc(`${ct.getName()}#${fd.name}`, funcType, newEnv);
}

export function tcMethodDef(ct: ClassType, fd: FuncDef) {
  console.log("curenv:", curEnv);
  console.log("curenv:", `${ct.getName()}#${fd.name}`);
  curEnv = curEnv.nameToChildEnv.get(`${ct.getName()}#${fd.name}`);
  console.log("curenv:", curEnv);

  tcFuncBody(fd.body);
  if (fd.retType !== "<None>") {
    if (!tcAllPathReturn(fd.body.stmts)) {
      throw new Error("All path in this method should have a return statement");
    }
  }
  curEnv = curEnv.parent;

  let memberFunc = curEnv.nameToFunc.get(`${ct.getName()}#${fd.name}`);
  if (ct.methods.has(fd.name)) {
    if (!memberFunc.isOverload(ct.methods.get(fd.name))) {
      throw new Error(`Method overload with mismatched signature: ${fd.name}`);
    }
  }
  ct.methods.set(fd.name, memberFunc);

  if (!ct.methodPtrs.has(fd.name)) {
    ct.methodPtrs.set(fd.name, ct.methodPtrs.size);
  }
  
  console.log(ct);
  memoryManager.collectFunc(memberFunc.globalName);
}

export function loadClassDef(cd: ClassDef) {
  if (curEnv.isRepeat(cd.name)) {
    throw new Error(`Already defined: ${cd.name}`);
  }

  let globalName = curEnv.name + "$" + cd.name;

  // prevent circular extends
  let parentType = curEnv.findClass(cd.parent);

  if (!parentType) {
    throw new Error(`Unknown type: ${cd.parent}`);
  }

  if (cd.parent === "int" || cd.parent === "bool") {
    throw new Error(`Can't extend builtin type: ${cd.parent}`);
  }

  let classType: ClassType = new ClassType(globalName, parentType, -1);
  curEnv.registerClass(cd.name, classType);
  memoryManager.classNameToTag.set(globalName, memoryManager.classNameToTag.size);
}

export function tcClassDef(cd: ClassDef) {
  let classType = curEnv.nameToClass.get(cd.name);

  if (classType.parent) {
    classType.parent.attributes.forEach((v, name) => {
      classType.attributes.set(name, v);
    });
    classType.parent.methods.forEach((f, name) => {
      classType.methods.set(name, f);
      classType.methodPtrs.set(name, classType.parent.methodPtrs.get(name));
    })
  }

  for (const varDef of cd.defs.varDefs) {
    tcAttributesDef(classType, varDef);
  }

  let methodNames: Set<string> = new Set();
  for (const funcDef of cd.defs.funcDefs) {
    if (funcDef.params.length === 0) {
      throw new Error(`The following member method should have at least one parameter: ${funcDef.name}`);
    }
    if (funcDef.params[0].type != cd.name) {
      throw new Error(`The first parameter of the following member method should be of the enclosing class: ${funcDef.name}`);
    }
    if (methodNames.has(funcDef.name)) {
      throw new Error(`Method redefined: ${funcDef.name}`);
    }
    methodNames.add(funcDef.name);

    loadMethodDef(classType, funcDef);
  }

  for (const funcDef of cd.defs.funcDefs) {
    tcMethodDef(classType, funcDef); 
  }

  classType.methodPtrsHead = memoryManager.dispatchTablesSize;
  memoryManager.dispatchTablesSize += classType.methods.size;

  classType.size = classType.headerSize + classType.attributes.size;

  console.log(classType);
}

export function tcDefs(pd: PreDef) {
  for (const classDef of pd.classDefs) {
    tcClassDef(classDef);
  }
  for (const funcDef of pd.funcDefs) {
    tcFuncDef(funcDef);
  }
  for (const varDef of pd.varDefs) {
    tcVarDef(varDef);
  }
}

export function tcProgram(p: Program, gm: MemoryManager, em: EnvManager) {
  memoryManager = gm;
  envManager = em;
  curEnv = em.getGlobalEnv();

  for (const classDef of p.defs.classDefs) {
    loadClassDef(classDef);
  }
  for (const funcDef of p.defs.funcDefs) {
    loadFuncDef(funcDef);
  }
  tcDefs(p.defs);
  for (const stmt of p.stmts) {
    tcStmt(stmt);
  }
}

















