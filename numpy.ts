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
import { NUM, BOOL, NONE, CLASS, LIST, importDel, importMethodDel } from "./utils";
import * as compiler from "./compiler";

export const ndarrayName = "numpy"+importDel+"ndarray";
export const arrayLikeTags = ["number", "bool", "list"];

export const ndarrayFields : Array<VarInit<null>> = [
	// TODO: add dtype field once string is implemented
	// {name: "dtype", type: {tag: "string"}, value: { tag: "string", value: "int32"} }, // assume int32
	// use shape0/shape1 for now; wait for merge with list team
	{name: "shape0", type: NUM, value: { tag: "num", value: -1} },
	{name: "shape1", type: NUM, value: { tag: "num", value: -1} },
	// ndarray pointer; an offset number to list in TS env 
	{name: "data", type: LIST, value: { tag: "num", value: -999} }
	// {name: "shape", type: {tag: "list", content_type: NUM }, value: { tag: "none"} } // use list as tuple
	// skip other fields e.g. stride, offset
];

// TODO: allow poly-type eg 5+a, np.array(10), np.array([true])
// assume all methods/functions have CLASS(name) as a
export const ndarrayMethods : Array<FunDef<any>> = [
	// method signature only; special codegen in compiler.ts
	{a: CLASS(ndarrayName), name: "add", // self.__add__(x2), element-wise add
	parameters: [{name: "self", type: CLASS(ndarrayName)}, 
				{name: "x2", type: CLASS(ndarrayName)}], 
	ret: CLASS(ndarrayName),
	decls: [], inits: [], funs: [], body: []},
	{a: CLASS(ndarrayName), name: "multiply", // np.multiply(self, x2), element-wise multiply
	parameters: [{name: "self", type: CLASS(ndarrayName)}, 
				{name: "x2", type: CLASS(ndarrayName)}], 
	ret: CLASS(ndarrayName),
	decls: [], inits: [], funs: [], body: []},
	{a: CLASS(ndarrayName), name: "divide", // np.divide(self, x2), element-wise divide
	parameters: [{name: "self", type: CLASS(ndarrayName)}, 
				{name: "x2", type: CLASS(ndarrayName)}], 
	ret: CLASS(ndarrayName),
	decls: [], inits: [], funs: [], body: []},
	{a: CLASS(ndarrayName), name: "subtract", // np.subtract(self, x2), element-wise subtract
	parameters: [{name: "self", type: CLASS(ndarrayName)}, 
				{name: "x2", type: CLASS(ndarrayName)}], 
	ret: CLASS(ndarrayName),
	decls: [], inits: [], funs: [], body: []},
	{a: CLASS(ndarrayName), name: "pow", // self.__pow__(x2), element-wise power
	parameters: [{name: "self", type: CLASS(ndarrayName)}, 
				{name: "x2", type: CLASS(ndarrayName)}], 
	ret: CLASS(ndarrayName),
	decls: [], inits: [], funs: [], body: []},
	{a: CLASS(ndarrayName), name: "dot", // self.dot(x2) or self @ x2, matrix multiplication
	parameters: [{name: "self", type: CLASS(ndarrayName)}, 
				{name: "x2", type: CLASS(ndarrayName)}], 
	ret: CLASS(ndarrayName),
	decls: [], inits: [], funs: [], body: []},
	{a: CLASS(ndarrayName), name: "flatten", // self.flatten()
	parameters: [{name: "self", type: CLASS(ndarrayName)}], 
	ret: CLASS(ndarrayName),
	decls: [], inits: [], funs: [], body: []},  
	{a: CLASS(ndarrayName), name: "tolist", // self.tolist()
	parameters: [{name: "self", type: CLASS(ndarrayName)}], 
	ret: LIST,
	decls: [], inits: [], funs: [], body: []},  
];

export const numpyMethods : Array<FunDef<any>> = [
	{a: CLASS("numpy"), name: "array", 
	parameters: [{name: "self", type: CLASS("numpy")}, 
				{name: "object", type: LIST}], // assume number for now; wait for list parsing
	ret: CLASS(ndarrayName), 
	decls: [], inits: [], funs: [], body: [] }
];

export function codeGenNumpyArray(expr: Expr<Type>, env: compiler.GlobalEnv): Array<string> {
  	if (expr.tag!=="method-call"){
	    throw new Error("Only method class of imported functions/menthods are supported.");
  	}

  	// reverse lists and static shape calculation
  	const listExpr = expr.arguments[0];
  	var lists : any;
  	let shape0 = -1;
  	let shape1 = -1;
  	switch (listExpr.tag) {
  		case "list-expr":
  			lists = reverseList(listExpr);
  			shape0 = lists.length;
  			if (lists[0] instanceof Array){
  				shape1 = lists[0].length;
  			}
  			break;
  		case "literal":
  			let val = listExpr.value;
  			if (val.tag!=="num"){
  				throw new Error(`${val.tag} not supported as literal in numpy array initialization`);
  			}
  			lists = val.value;
  	}

  	// save list in TS env; set lists field as its index in TS env
  	const listIdx = compiler.tsHeap.length;
  	compiler.tsHeap.push(lists);
  	// console.log("numpy array", lists, listIdx);

  	// shape and lists pointer initialization by accessing WASM heap directly
	var stmts: Array<string> = [];
	env.classes.get(ndarrayName).forEach(([offset, initVal], field) => {
		let val;
		switch (field) {
	    	case "shape0":
	    		val = shape0;
	    		break;
	    	case "shape1":
	    		val = shape1;
	    		break;
	    	case "data":
	    		val = listIdx;
	    		break;
	    }
	    stmts = stmts.concat(
	      [`(i32.load (i32.const 0))`, // Load the dynamic heap head offset
	        `(i32.add (i32.const ${offset * 4}))`, // Calc field offset from heap offset
	        `(i32.const ${val})`, // Initialize field
	        "(i32.store)", // Put the default field value on the heap
	      ])
	});

	// const callName = ndarrayName+importMethodDel+"__init__";
	return stmts.concat([
	    "(i32.load (i32.const 0))", // Get address for the object (this is the return value)
	    "(i32.const 0)", // Address for our upcoming store instruction
	    "(i32.load (i32.const 0))", // Load the dynamic heap head offset
	    `(i32.add (i32.const ${env.classes.get(ndarrayName).size * 4}))`, // Move heap head beyond the two words we just created for fields
	    "(i32.store)", // Save the new heap offset
	]);
} 

export function codeGenNdarrayUniOp(expr: Expr<Type>, env: compiler.GlobalEnv): Array<string> {
  	if ( (expr.tag!=="method-call") || (expr.obj.a.tag!=="class")){
	    throw new Error("Report this as a bug to the compiler developer.");
  	}
    var stmts = compiler.codeGenExpr(expr.obj, env);
    switch (expr.method) {
    	case "flatten":
    	case "tolist":
    		break;
    	default:
    		throw new Error(`uniop method ${expr.method} not supported`);
    		break;
    }
    var callName = expr.obj.a.name+importMethodDel+expr.method;
    return [...stmts, `(call $${callName})`];
} 

export function codeGenNdarrayBinOp(expr: Expr<Type>, env: compiler.GlobalEnv): Array<string> {
  	if ( (expr.tag!=="binop") || ((expr.left.a.tag!=="class") && (expr.right.a.tag!=="class")) ){
	    throw new Error("At least one operand must be ndarray.");
  	}

  	var expr_ndarray : Expr<Type> = expr.left;
  	var expr_broadcast : Expr<Type> = expr.right;
  	if (arrayLikeTags.includes(expr.left.a.tag)){
  		expr_ndarray = expr.right;
  		expr_broadcast = expr.left;
  	}

  	switch (expr_broadcast.a.tag) {
  		case "number":
  			if (expr_broadcast.tag==="literal"){
  				let lit = expr_broadcast.value;
  				if (lit.tag==="num"){ // overwrite numbers as ndarrays; will broadcast in run-time
	  				expr_broadcast = {a: CLASS(ndarrayName),
							  		  tag: "method-call", 
							  		  obj: { a: CLASS("numpy"), tag: "id", name: "np"}, // TODO: generalize when alias is not np
						 		      method: "array", 
						 			  arguments: [{ a: LIST, tag: "list-expr", 
						 			  				contents: [{tag: "literal", 
						 			  							value: { tag: "num", value: lit.value}}]}]};
			}}
  			break;
		case "class":
  			if (expr_broadcast.a.name===ndarrayName){
  				break;
  			}
  		default:
  			throw new TypeError(`broadcasting type ${expr_broadcast.tag} not supported`);
  			break;
  	}

    var stmts = compiler.codeGenExpr(expr_ndarray, env);
    stmts = stmts.concat(compiler.codeGenExpr(expr_broadcast, env));
    let methodName;
    switch (expr.op) {
    	case BinOp.Mul:
    		methodName = "multiply";
    		break;
    	case BinOp.Minus:
    		methodName = "subtract";
    		break;
    	case BinOp.IDiv:
    		methodName = "divide";
    		break;
    	case BinOp.Plus:
    		methodName = "add";
    		break;
    	case BinOp.Pow:
    		methodName = "pow";
    		break;
    	case BinOp.MatMul:
    		methodName = "dot";
    		break;
    	default:
    		throw new Error(`binop enum ${expr.op} not supported`);
    		break;
    }
    var callName = ndarrayName+importMethodDel+methodName;
    return [...stmts, `(call $${callName})`];
} 

// ndarray uniop methods
export function ndarray_tolist(self: number): number {
	// self: offset (byte) of ndarray object's first field in wasm heap
	// return: offset (index) of flattened ndarray list in ts heap
	const listIdx = getField(ndarrayFieldNames, self, "data");
	var lists : Array<any> = compiler.tsHeap[listIdx];
  	const listIdxRet = compiler.tsHeap.length;
	compiler.tsHeap.push(nj.array(lists).tolist());
  	// console.log("tolist", self, lists, listIdx, listIdxRet);
  	return listIdxRet;
}

export function ndarray_flatten(self: number): number {
	const [shapes, listsAll] = ndarrayMethod([self], "flatten");
	// console.log(shapes, listsAll);
  	return createNdarray(shapes[0], shapes[1], 
  	                     nj.array(listsAll[0]).flatten().tolist());
}

// ndarray binop methods
export function ndarray_add(self: number, x2: number): number {
	// self: offset (byte) of ndarray object's first field  in wasm heap
	// x2: offset (byte) of another ndarray object in wasm heap
	// return: offset (byte) of new ndarray object in wasm heap (stores offset to first field)
	const [shapes, listsAll] = ndarrayMethod([self, x2], "add");
	// console.log(shapes, listsAll, compiler.tsHeap);
  	return createNdarray(shapes[0], shapes[1], 
  	                     nj.array(listsAll[0]).add(nj.array(listsAll[1])).tolist());
}

export function ndarray_divide(self: number, x2: number): number {
	const [shapes, listsAll] = ndarrayMethod([self, x2], "divide");
  	return createNdarray(shapes[0], shapes[1], 
  	                     nj.array(listsAll[0]).divide(nj.array(listsAll[1])).tolist());
}

export function ndarray_multiply(self: number, x2: number): number {
	const [shapes, listsAll] = ndarrayMethod([self, x2], "multiply");
  	return createNdarray(shapes[0], shapes[1], 
  	                     nj.array(listsAll[0]).multiply(nj.array(listsAll[1])).tolist());
}

export function ndarray_subtract(self: number, x2: number): number {
	const [shapes, listsAll] = ndarrayMethod([self, x2], "subtract");
  	return createNdarray(shapes[0], shapes[1], 
  	                     nj.array(listsAll[0]).subtract(nj.array(listsAll[1])).tolist());
}

export function ndarray_pow(self: number, x2: number): number {
	const [shapes, listsAll] = ndarrayMethod([self, x2], "pow");
  	return createNdarray(shapes[0], shapes[1], 
  	                     nj.array(listsAll[0]).pow(nj.array(listsAll[1])).tolist());
}

export function ndarray_dot(self: number, x2: number): number {
	const [shapes, listsAll] = ndarrayMethod([self, x2], "dot");
  	return createNdarray(shapes[0], shapes[1], 
  	                     nj.array(listsAll[0]).dot(nj.array(listsAll[1])).tolist());
}

// numpy utils below
export const ndarrayFieldNames : Array<string> = [];
ndarrayFields.forEach((f) => {ndarrayFieldNames.push(f.name)});

// generate all method imports in wat
export const numpyWAT = `
(func $print_lists (import "imports" "print_lists") (param i32) (result i32))
`+codeGenImport(ndarrayName, ndarrayMethods).join("\n");

export type Ndarray = {
	self: number,
	shape: Array<number>,
	data: Array<any>,
}

export function ndarrayMethod(selfs: Array<number>, method: string) : [Array<number>, Array<Array<any>>] {
	const ndarrays : Array<Ndarray> = [];
	const listsAll : Array<Array<any>> = [];

	selfs.forEach((s) => {
		let shape0 = getField(ndarrayFieldNames, s, "shape0");
		let shape1 = getField(ndarrayFieldNames, s, "shape1");
		let listIdx = getField(ndarrayFieldNames, s, "data");
		let lists : Array<any> = compiler.tsHeap[listIdx];
		ndarrays.push({self: s, shape: [shape0, shape1], data: lists});
		listsAll.push(lists);
	});

	// check shape compatible
	var shapes: Array<number> = [];
	switch (method) {
		case "add":
		case "subtract":
		case "multiply":
		case "divide":
		case "pow":
			// all dimensions on trailing axes should match or one ndarray's shape should be 1
			// reference: https://numpy.org/doc/stable/user/theory.broadcasting.html#array-broadcasting-in-numpy
			shapes = ndarrays[0].shape.slice();
			let shapesTrail = shapes.slice();
			for (let a of ndarrays){
				shapes.forEach((s, i) => {
					shapes[i] = Math.max(shapes[i], a.shape[i]);
					if (a.shape[i]===-1) {
						shapesTrail[i] = -1;
					}else{
						shapesTrail[i] = shapes[i];
					}
				});
			}
			// TODO: check single 1s
			ndarrays.forEach( (a, j) => {
				shapesTrail.forEach((s, i) => {
					if (s!==-1 && a.shape[i]===1){
						listsAll[j] = compiler.tsHeap[broadcastNdarray(selfs[j], shapes)];
					} else if (s!==-1 && s!==a.shape[i]){
						throw new TypeError(`operands could not be broadcast together with shapes
		                    ${s}, ${a.shape[i]} on dimension ${i}`);
					}
				})
			});
			break;
		case "dot":
			// last dimension should match second-last dimension
			let shape1 = ndarrays[0].shape;
			let shape2 = ndarrays[1].shape;
			if (shape1[shape1.length-1]!==shape2[shape2.length-2]){
				throw new TypeError(`operands could not be broadcast together with shapes
                    ${shape1[shape1.length-1]}, ${shape2[shape2.length-2]} on 1st vs last-2nd dimensions`);
			}
			shapes = shape1.slice(0,shape1.length-1).concat(shape2[shape2.length-1]);
			break;
		case "flatten":
			// use original shape 
			shapes = ndarrays[0].shape;
			break;
	}

	// TODO: call enumerated methods by name using windows(); create and return ndarray offset directly
	return [shapes, listsAll];
}

export function createNdarray(shape0: number, shape1: number, lists: Array<any>): number {
  	const listIdx = compiler.tsHeap.length; // ts heap offset
	compiler.tsHeap.push(lists);

	const offsetObj = compiler.wasmHeap[0];
	compiler.wasmHeap[0] +=  4; // will create a new global in wasm heap (though not visible in env)
	var offset = compiler.wasmHeap[0]/4; // wasm heap offset (divide byte by 4 to get index)
	compiler.wasmHeap[offset] = shape0; // save fields in wasm heap
	compiler.wasmHeap[offset+1] = shape1;
	compiler.wasmHeap[offset+2] = listIdx;
	compiler.wasmHeap[0] = (offset+3)*4; // update wasm heap offset (multiply index by 4 to get byte)
	compiler.wasmHeap[offsetObj/4] = offset*4; // save offset value into this new global
	// console.log("create", offsetObj, offset, compiler.wasmHeap[0], "fields", shape0, shape1, listIdx, lists);
	return offset*4; // return wasm heap value (not byte offset!l; ie offset of first field) for this ndarray object
}

export function broadcastNdarray(self: number, shapes: Array<number>): number {
	// self: ndarray's first field's offset in wasm heap
	// target: broadcast-target shapes
	// return: lists offset of broadcast self in ts heap

	// TODO:  generalize broadcasting for non-numbers and non-2d ndarrays
	const num = compiler.tsHeap[getField(ndarrayFieldNames, self, "data")][0];
	// console.log(self, shapes, num);
	const lists = Array.from(Array(shapes[0]), _ => Array(shapes[1]).fill(num));
	const listIdx = compiler.tsHeap.length;
	compiler.tsHeap.push(lists);
	return listIdx;
} 

export function getField(fields: Array<string>, offset: number, field: string) : number {
	if (!fields.includes(field)){
		throw new Error(`field ${field} not found in ndarray`);
	}
    return compiler.wasmHeap[(offset/4)+fields.indexOf(field)]; // offset is in byte!
}

export function codeGenImport(name: string, methods: Array<FunDef<any>>) : Array<string> {
	const imports : Array<string> = [];
	methods.forEach((m) => {
		let callName = name+importMethodDel+m.name;
		let importStr = `(func $${callName} (import "imports" "${callName}") `;
		m.parameters.forEach( (p) => {
			importStr += "(param i32) ";
		});
		if (m.ret.tag!=="none"){
			importStr += "(result i32)";
		}
		importStr += ")";
		imports.push(importStr);
	});
	return imports;
}

export function reverseList(expr: Expr<Type>): Array<any> {
	// reverse list-expr as Array in TS
	const lists: Array<any> = []
	if (expr.tag==="list-expr"){
  		expr.contents.forEach( (l) => {
  			let listContent : any;
  			switch (l.tag) {
  				case "list-expr":
  					listContent = reverseList(l);
  					break;
  				case "literal":
  					let val = l.value;
  					switch (val.tag) {
  						case "num":
  							listContent = val.value
  							break;
  						default:
  							throw new Error(`${val.tag} literal not supported in numpy.array initialization`)
  					}
  					break;
  				case "uniop":
  					switch (l.op) {
  						case UniOp.Neg:
  							let opexpr = l.expr;
  							if (opexpr.tag!=="literal"){
  								throw new Error(`report this bug to developer`);
  							}
  							let opexprl = opexpr.value;
  							if (opexprl.tag!=="num"){
  								throw new Error(`report this bug to developer`);
  							}
  							listContent = -opexprl.value;
  							break;
  						default:
  							throw new Error(`${l.op} uniop not supported in numpy.array initialization`)
  					}
  					break;
  				default:
  					throw new Error(`${l.tag} not supported in numpy.array initialization`)
  					break;
  			}
  			lists.push(listContent);
  		});
  	}
	return lists;
}