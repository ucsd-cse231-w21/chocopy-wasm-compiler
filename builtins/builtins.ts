import { Type, typeToString, Value } from "../ast";
import { ClassPresenter, FuncIdentity, ModulePresenter } from "../types";
import { NONE } from "../utils";

export const otherModule : BuiltInModule = new class implements BuiltInModule {
    readonly name: string;
    readonly classes : Map<string, BuiltInClass>;
    readonly variables: Map<string, BuiltVariable>;
    readonly functions: Map<string, BuiltInFunction>;

    /**
     * Can be used to attach a ModulePresenter for subsequent typechecks
     */
    presenter: ModulePresenter;

    constructor(){
        this.name = "otherModule";
        this.classes = new Map();
        this.variables = new Map();
        this.functions = new Map([
            ["someFunc()", {isConstructor: false, 
                            identity: {signature: {name: "someFunc", parameters: []}, 
                                       returnType: NONE},
                            func: this.someFunc}],
            ["otherFunc()", {isConstructor: false, 
                            identity: {signature: {name: "otherFunc", parameters: []}, 
                                       returnType: NONE},
                            func: this.otherFunc}],               
        ]);
    }

    someFunc() : Value{
        console.log("in some func!");
        return {tag: "none"}
    }

    otherFunc() : Value{
        console.log("in other func!");
        return {tag: "none"}
    }
}

/**
 * Represents a built-in ChocoPy module
 * whose internal code is actually written in Type/Javascript
 */
export interface BuiltInModule {
    readonly name: string,
    readonly classes : Map<string, BuiltInClass>,
    readonly variables: Map<string, BuiltVariable>,
    readonly functions: Map<string, BuiltInFunction>,

    /**
     * Can be used to attach a ModulePresenter for subsequent typechecks
     */
    presenter: ModulePresenter
};

export interface BuiltInClass {
    readonly name: string,
    readonly variables: Map<string, BuiltVariable>,
    readonly methods: Map<string, BuiltInFunction>

    /**
     * Can be used to attach a ClassPresenter for subsequent typechecks
     */
    presenter: ClassPresenter
};

export type BuiltInFunction = {
    isConstructor: boolean,
    identity: FuncIdentity,
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

export function attachClassPresenter(c: BuiltInClass){
    const presenter : ClassPresenter = {
        name: c.name,
        instanceVars: new Map(),
        instanceMethods: new Map()
    }

    for(let [name, info] of c.variables.entries()){
        presenter.instanceVars.set(name, info.getType());
    }

    for(let [sig, info] of c.methods.entries()){
        presenter.instanceMethods.set(sig, info.identity);
    }


    c.presenter = presenter;
}

export function attachPresenter(b: BuiltInModule) {
    const presenter : ModulePresenter = {
        moduleVars: new Map(),
        functions: new Map(),
        classes: new Map()
    }

    for(let [name, info] of b.variables.entries()){
        presenter.moduleVars.set(name, info.getType());
    }

    for(let [sig, info] of b.functions.entries()){
        presenter.functions.set(sig, info.identity);
    }

    for(let [name, info] of b.classes.entries()){
        attachClassPresenter(info);
        presenter.classes.set(name, info.presenter);
    }

    b.presenter = presenter;
}

export function gatherPresenters(modules: Map<string, BuiltInModule>) {
    const ret: Map<string, ModulePresenter> = new Map();
    for(let [name, mod] of modules.entries()){
        ret.set(name , mod.presenter);
    }
    return ret;
}