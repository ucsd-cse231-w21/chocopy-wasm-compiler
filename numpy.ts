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

export const numpyFields : Array<VarInit<null>> = [
	{name: "dtype", type: {tag: "string"}, value: { tag: "string", value: "int32"} }, // assume int32
	// use shape0/shape1 for now; wait for ast update on list value type
	{name: "shape0", type: {tag: "number"}, value: { tag: "num", value: -1} },
	{name: "shape1", type: {tag: "number"}, value: { tag: "num", value: -1} }
	// {name: "shape", type: {tag: "list", content_type: {tag: "number"} }, value: { tag: "none"} } // use list as tuple
	// skip other fields e.g. stride, offset
];

export const numpyMethods : Array<FunDef<null>> = [
	// method signature only; special codegen in compiler.ts
	{name: "__add__", // x1.__add__(x2)
	parameters: [{name: "x2", type: {tag: "class", name: "numpy"}}], 
	ret: {tag: "class", name: "numpy"},
	decls: [],
	inits: [],
	funs: [],
	body: []}
];



// var a = nj.array([2,3,4]);
// console.log(a)
