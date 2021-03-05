import * as nj from "numjs";
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
} from "./ast";
import { importPostfix } from "./utils";

export const numpyFields : Array<VarInit<null>> = [
	{name: "dtype", type: {tag: "string"}, value: { tag: "string", value: "int32"} }, // assume int32
	// use shape0/shape1 for now; wait for ast update on list value type
	{name: "shape0", type: {tag: "number"}, value: { tag: "num", value: BigInt(-1)} },
	{name: "shape1", type: {tag: "number"}, value: { tag: "num", value: BigInt(-1)} },
	// ndarray pointer; assume its numeric content for now; later will be an offset number to list (in TS env or WASM heap) 
	{name: "ndarray", type: {tag: "number"}, value: { tag: "num", value: BigInt(-999)} }
	// {name: "shape", type: {tag: "list", content_type: {tag: "number"} }, value: { tag: "none"} } // use list as tuple
	// skip other fields e.g. stride, offset
];

export const numpyMethods : Array<FunDef<null>> = [
	// TODO: update parameters for self here or in type-check.ts
	// method signature only; special codegen in compiler.ts
	{name: "__add__", // self.__add__(x2), element-wise add
	parameters: [{name: "x2", type: {tag: "class", name: "numpy"}}], 
	ret: {tag: "class", name: "numpy"},
	decls: [], inits: [], funs: [], body: []},
	{name: "dot", // self.dot(x2) or self @ x2, matrix multiplication
	parameters: [{name: "x2", type: {tag: "class", name: "numpy"}}], 
	ret: {tag: "class", name: "numpy"},
	decls: [], inits: [], funs: [], body: []} 
];

export const numpyImportMethods : Array<FunDef<null>> = [
	// TODO: update parameters for self here or in type-check.ts
	{name: "array", 
	parameters: [{name: "object", type: {tag: "number"}}], // assume number for now; wait for list parsing
	ret: {tag: "class", name: "numpy"}, 
	decls: [], inits: [], funs: [], body: [] }
];

export function numpyArray(obj: number) : number {
	// TODO: enable list parameter; add dynamic shape calculation; return heap offset
	return 999;
} 

// var a = nj.array([2,3,4]);
// console.log(a)
