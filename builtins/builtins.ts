import { Type, typeToString, Value } from "../ast";
import { Instance, MainAllocator } from "../heap";
import { ClassPresenter, FuncIdentity, ModulePresenter } from "../types";
import { NONE } from "../utils";
/**
 * Represents a built-in ChocoPy module
 * whose internal code is actually written in Type/Javascript
 */
export abstract class BuiltInModule {
    readonly name: string;
    readonly classes : Map<string, BuiltInClass>;
    readonly variables: Map<string, BuiltVariable>;
    readonly functions: Map<string, BuiltInFunction>;

    /**
     * Can be used to attach a ModulePresenter for subsequent typechecks
     */
    presenter: ModulePresenter;

    readonly allocator: MainAllocator;

    constructor(allocator: MainAllocator){
        this.allocator = allocator;
    }
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
    func: (...arg: Instance[]) => number,  
};

export class BuiltVariable {
    private var : number;
    private type : Type;
    private name : string;

    constructor(name: string, type : Type){
        this.name = name;
        this.type = type;
    }

    set(newVal: number) : void {
        this.var = newVal;
    }

    get() : number {
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
        presenter.instanceVars.set(name, {type: info.getType()});
    }

    for(let [sig, info] of c.methods.entries()){
        presenter.instanceMethods.set(sig, info.identity);
    }


    c.presenter = presenter;
}

export function attachPresenter(b: BuiltInModule) {
    const presenter : ModulePresenter = {
        name: b.name,
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

//-----------ACTUAL MODULES--------------
export class NativeTypes extends BuiltInModule{
    readonly name: string;
    readonly classes : Map<string, BuiltInClass>;
    readonly variables: Map<string, BuiltVariable>;
    readonly functions: Map<string, BuiltInFunction>;

    presenter: ModulePresenter;

    constructor(allocator: MainAllocator){
        super(allocator);
        this.name = "natives";
        this.classes = new Map();
        this.variables = new Map();
        this.functions = new Map([
            ["print()", {isConstructor: false, 
                            identity: {signature: {name: "print", parameters: [{tag: "class", name: "object"}]}, 
                                       returnType: NONE},
                            func: this.print}]             
        ]);
    }

    print(... args:  Instance[]) : number{
        console.log("hello world! from builtin");
        return 0;
    }
}


export class OtherModule extends BuiltInModule {
    readonly name: string;
    readonly classes : Map<string, BuiltInClass>;
    readonly variables: Map<string, BuiltVariable>;
    readonly functions: Map<string, BuiltInFunction>;

    /**
     * Can be used to attach a ModulePresenter for subsequent typechecks
     */
    presenter: ModulePresenter;


    constructor(allocator: MainAllocator){
        super(allocator);
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

    someFunc() : number{
        console.log("in some func!");
        return 0;
    }

    otherFunc() : number{
        console.log("in other func!");
        return 0;
    }
};