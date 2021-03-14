import { Variable, FuncType, ClassType } from "./ast";

export class Env {
  name: string;
  parent: Env;
  nameToVar: Map<string, Variable>;
  nameToFunc: Map<string, FuncType>;
  nameToClass: Map<string, ClassType>;
  nameToChildEnv: Map<string, Env>;

  envManager: EnvManager;

  constructor(name: string, parent: Env, envManager: EnvManager) {
    this.name = name;
    this.parent = parent;
    this.nameToVar = new Map();
    this.nameToFunc = new Map();
    this.nameToClass = new Map();
    this.nameToChildEnv = new Map();
    this.envManager = envManager;
  }

  findVar(name: string): Variable {
    let iterEnv = this as Env;
    while (iterEnv) {
      if (iterEnv.nameToVar.has(name)) {
        return iterEnv.nameToVar.get(name);
      }
      iterEnv = iterEnv.parent;
    }
    return null;
  }

  findFunc(name: string): FuncType {
    let iterEnv = this as Env;
    while (iterEnv) {
      if (iterEnv.nameToFunc.has(name)) {
        return iterEnv.nameToFunc.get(name);
      }
      iterEnv = iterEnv.parent;
    }
    return null;
  }

  findClass(name: string): ClassType {
    let iterEnv = this as Env;
    while (iterEnv) {
      if (iterEnv.nameToClass.has(name)) {
        return iterEnv.nameToClass.get(name);
      }
      iterEnv = iterEnv.parent;
    }
    return null;
  }

  isRepeat(name: string): boolean {
    if (this.nameToVar.has(name) || this.nameToFunc.has(name) || this.nameToClass.has(name)) {
      return true;
    }
    return false;
  }

  registerClass(name: string, cls: ClassType) {
    this.nameToClass.set(name, cls);
    // this.nameToChildEnv.set(name, env);
    this.envManager.classMap.set(cls.globalName, cls);
    // Env.envMap.set(cls.globalName, env);
  }

  registerFunc(name: string, func: FuncType, env: Env) {
    this.nameToFunc.set(name, func);
    this.nameToChildEnv.set(name, env);
    this.envManager.funcMap.set(func.globalName, func);
    this.envManager.envMap.set(func.globalName, env);
  }
}

export class EnvManager {
  envMap: Map<string, Env> = new Map();
  funcMap: Map<string, FuncType> = new Map();
  classMap: Map<string, ClassType> = new Map();

  globalEnv: Env;

  constructor() {
    this.globalEnv = new Env("", null, this);
    this.envMap.set(this.globalEnv.name, this.globalEnv);
    this.initBuiltin();
  }

  getGlobalEnv(): Env {
    return this.globalEnv;
  }

  initBuiltin() {
    let curEnv = this.globalEnv;
    const objTypeName = "object";
    const objTypeGlobalName = curEnv.name + "$" + objTypeName;
    let objType: ClassType = new ClassType(objTypeGlobalName, null, -1);
    
    curEnv.registerClass(objTypeName, objType);
    
    const boolTypeName = "bool";
    let boolType: ClassType = new ClassType(curEnv.name + "$" + boolTypeName, objType, 1);
  
    const boolOps: Array<FuncType> = [
      new FuncType(boolType.globalName + "$__eq__", [boolType, boolType], boolType, true),
      new FuncType(boolType.globalName + "$__neq__", [boolType, boolType], boolType, true),
      new FuncType(boolType.globalName + "$__and__", [boolType, boolType], boolType, true),
      new FuncType(boolType.globalName + "$__or__", [boolType, boolType], boolType, true),
      new FuncType(boolType.globalName + "$__not__", [boolType], boolType, true),
    ]
  
    for (const boolOp of boolOps) {
      boolType.methods.set(boolOp.getName(), boolOp);
    }

    // const objOps: Array<FuncType> = [
    //   new FuncType(objType.globalName + "$__is__", [objType], boolType),
    // ]
    // for (const objOp of objOps) {
    //   objType.methods.set(objOp.getName(), objOp);
    // }
  
    curEnv.registerClass(boolTypeName, boolType);
  
    const intTypeName = "int";
    let intType: ClassType = new ClassType(curEnv.name + "$" + intTypeName, objType, 2);
  
    const intOps: Array<FuncType> = [
      new FuncType(intType.globalName + "$__neg__", [intType], intType, true),
  
      new FuncType(intType.globalName + "$__add__", [intType, intType], intType, true),
      new FuncType(intType.globalName + "$__sub__", [intType, intType], intType, true),
      new FuncType(intType.globalName + "$__mul__", [intType, intType], intType, true),
      new FuncType(intType.globalName + "$__divn__", [intType, intType], intType, true),
      new FuncType(intType.globalName + "$__mod__", [intType, intType], intType, true),
  
      new FuncType(intType.globalName + "$__eq__", [intType, intType], boolType, true),
      new FuncType(intType.globalName + "$__neq__", [intType, intType], boolType, true),
      new FuncType(intType.globalName + "$__le__", [intType, intType], boolType, true),
      new FuncType(intType.globalName + "$__ge__", [intType, intType], boolType, true),
      new FuncType(intType.globalName + "$__lt__", [intType, intType], boolType, true),
      new FuncType(intType.globalName + "$__gt__", [intType, intType], boolType, true),
    ]
  
    for (const intOp of intOps) {
      intType.methods.set(intOp.getName(), intOp);
    }
  
    curEnv.registerClass(intTypeName, intType);
  
    const noneTypeName = "<None>";
    let noneType: ClassType = new ClassType(curEnv.name + "$" + noneTypeName, objType, 0);
    curEnv.registerClass(noneTypeName, noneType);
  
    const builtinFuncs: Array<FuncType> = [
      new FuncType(curEnv.name + "$" + "print#" + objTypeName, [objType], noneType, false),
      new FuncType(curEnv.name + "$" + "print#" + intTypeName, [intType], noneType, false),
      new FuncType(curEnv.name + "$" + "print#" + boolTypeName, [boolType], noneType, false),
    ]
  
    for (const builtinFunc of builtinFuncs) {
      curEnv.registerFunc(builtinFunc.getName(), builtinFunc, null);
    }
  }
}

