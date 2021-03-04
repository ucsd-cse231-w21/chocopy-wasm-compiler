import { builtinModules } from "module";
import { Type, typeToString, Value } from "../ast";
import { GlobalTypeEnv } from "../type-check";
import { NONE } from "../utils";


export const otherModule : BuiltInModule = {
    classes : new Map(),
    variables : new Map(),
    functions : new Map(
        [
            ["someFunc", {name: "someFunc", 
                          isConstructor: false, 
                          parameters: new Array(),
                          ret: NONE,
                          func: () => {console.log("You're in someFunc!"); return {tag: "none"}}}],
            ["otherFunc", {name: "otherFunc", 
                          isConstructor: false, 
                          parameters: new Array(),
                          ret: NONE,
                          func: () => {console.log("You're in otherFunc!"); return {tag: "none"}}}]
        ]
    )
}

/**
 * Represents a built-in ChocoPy module
 * whose internal code is actually written in Type/Javascript
 */
export type BuiltInModule = {
    classes : Map<string, BuiltInClass>,
    variables: Map<string, BuiltVariable>,
    functions: Map<string, BuiltInFunction>
};

export type BuiltInClass = {
    variables: Map<string, BuiltVariable>,
    methods: Map<string, BuiltInFunction>
};

export type BuiltInFunction = {
    name: string,
    isConstructor: boolean,
    parameters: Array<Type>,
    ret: Type,
    func: () => Value,  //so far, we'll only support no-arg functions
};

export class BuiltVariable {
    private var : Value;
    private type : Type;
    private name : string;

    constructor(name: string, type : Type, initValue? : Value){
        if(initValue === undefined){
            this.var = {tag: "none"};
        }
        else{
            this.var = initValue;
        }
        this.name = name;
        this.type = type;
    }

    set(newVal: Value) : void {
        this.var = newVal;
    }

    get() : Value {
        return this.var;
    }

    getName(){
        return this.name;
    }

    getType(){
        return this.type;
    }
}

export function descToGlobalEnv(b: BuiltInModule) : GlobalTypeEnv {
    const gVars : Map<string, Type> = new Map();
    const gFuncs : Map<string, [Array<Type>, Type]> = new Map();
    const gClasses : Map<string, [Map<string, Type>, Map<string, [Array<Type>, Type]>]> = new Map();

    //assign global variables
    for(let [name, vars] of b.variables.entries()){
        gVars.set(name, vars.getType());
    }

    //assign functions
    for(let [name, func] of b.functions.entries()){
        gFuncs.set(name, [func.parameters , func.ret]);
    }

    //assign classes
    for(let [name, classDef] of b.classes.entries()){
        const instanceVars : Map<string, Type> = new Map();
        const methods: Map<string, [Array<Type>, Type]> = new Map();

        classDef.variables.forEach(x => instanceVars.set(x.getName(), x.getType()));
        classDef.methods.forEach(x => methods.set(x.name, [x.parameters, x.ret]));
    }

    return {globals : gVars, functions : gFuncs, classes : gClasses};
}

export abstract class Module{

    abstract initialize() : void;
    
    abstract getDescription() : BuiltInModule;
}

