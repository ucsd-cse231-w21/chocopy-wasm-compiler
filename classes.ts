// -*- mode: typescript; typescript-indent-level: 2; -*-

import { Expr, Parameter, Type } from "./ast";
import { GlobalEnv, ClassEnv, FuncEnv } from "./env";

export function getClassTableSize(className: string, env: GlobalEnv): number {
    const classRef: ClassEnv = env.classes.get(className);
    const memberFunCnt: number = (classRef.memberFuncs.size - 1); // Remove 1 for ctor
    const result: number = memberFunCnt * 8; // bytes
    
    return result;
}

export function getClassHeapSize(className: string, env: GlobalEnv): number {
    const classRef: ClassEnv = env.classes.get(className);
    const memberCnt: number = (classRef.memberVars.size + 1); // Extra one for the table offset ptr
    const result: number = memberCnt * 8; // bytes
    
    return result;
}

export function getClassMemVars(className: string, env: GlobalEnv): Map<string, [Expr, Type]> {
    const classRef: ClassEnv = env.classes.get(className);
    
    return classRef.memberVars;
}

export function getMemOffset(className: string, funName: string, env: GlobalEnv): number {
  const classRef: ClassEnv = env.classes.get(className);

  var id = 0;
  var found = false;
  classRef.memberFuncs.forEach(f => {
    if (!found) {
      if (f.name == funName) {
	found = true;
	return;
      } else {
	id += 1;
      }
    }
  });

  if (!found) {
    return undefined;
  } else {
    return id*8;
  }  
}

export function getFieldOffset(className: string, varName: string, env: GlobalEnv): number {
  const classRef: ClassEnv = env.classes.get(className);

  console.log("memvars:");
  console.log(classRef.memberVars);
  
  var id = 0;
  var found = false;
  classRef.memberVars.forEach((_, key) => {
    if (!found) {
      if (key == varName) {
	found = true;
	return;
      } else {
	id += 1;
      }
    }
  });

  if (!found) {
    return undefined;
  } else {
    return id*8;
  }  
}

export function getLocal(localParams: Array<Parameter>, name: string) : boolean {
  var result:boolean = false;
  localParams.forEach((p) => {
    if (p.name == name) {
      result = true;
    }
  })
  
  return result;
}

export function getClassName(varName: string, env: GlobalEnv, localParams: Array<Parameter> = []): Type {
  if (getLocal(localParams, varName)) {
    localParams.forEach( p => {
      if (p.name == varName) {
	return p.type;
      }
    });
    return undefined;
  } else {
    return env.globals.get(varName)[0];
  }
}
