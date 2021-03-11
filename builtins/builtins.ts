import { Type, typeToString, Value } from "../ast";
import { Instance, MainAllocator } from "../heap";
import { ClassPresenter, FuncIdentity, idenToStr, ModulePresenter } from "../types";
import { CLASS, NONE, NUM } from "../utils";
/**
 * Represents a built-in ChocoPy module
 * whose internal code is actually written in Type/Javascript
 */
export abstract class BuiltInModule {
    readonly name: string;
    readonly classes : Map<string, BuiltInClass>;
    readonly variables: Map<string, BuiltVariable>;

    /**
     * Keys - function signature as key
     */
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

export abstract class BuiltInClass {
    readonly name: string;
    readonly variables: Map<string, BuiltVariable>;
    readonly methods: Map<string, BuiltInFunction>;

    /**
     * Can be used to attach a ClassPresenter for subsequent typechecks
     */
    presenter: ClassPresenter;

    readonly allocator: MainAllocator;

    constructor(allocator: MainAllocator){
        this.allocator = allocator;
    }
};

export type BuiltInFunction = {
    isConstructor: boolean,
    identity: FuncIdentity,
    func: (...arg: number[]) => number,  
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
        presenter.instanceVars.set(name, info.getType());
    }

    for(let [_, info] of c.methods.entries()){
        presenter.instanceMethods.set(idenToStr(info.identity), info.identity);
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

    for(let [_, info] of b.functions.entries()){
        presenter.functions.set(idenToStr(info.identity), info.identity);
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
export class BString extends BuiltInClass{
    readonly name: string;
    readonly variables: Map<string, BuiltVariable>;
    readonly methods: Map<string, BuiltInFunction>;

    /**
     * Can be used to attach a ClassPresenter for subsequent typechecks
     */
    presenter: ClassPresenter;

    constructor(allocator: MainAllocator){
        super(allocator);
        this.name = "string";
        this.variables = new Map();
        this.methods = new Map([
            ["length()", 
                {
                    isConstructor: false,
                    identity: {signature: {name: "length", parameters: [CLASS("string")]}, 
                            returnType: NONE},
                    func: this.length
                }
            ]
        ]);
    }

    length(... args:  number[]) : number{
        const stringIns = this.allocator.getStr(args[0]);
        return this.allocator.allocInt(stringIns.length);
    }
}

export class NativeTypes extends BuiltInModule{
    readonly name: string;
    readonly classes : Map<string, BuiltInClass>;
    readonly variables: Map<string, BuiltVariable>;
    readonly functions: Map<string, BuiltInFunction>;

    presenter: ModulePresenter;

    constructor(allocator: MainAllocator){
        super(allocator);
        this.name = "natives";
        this.classes = new Map([

        ]);
        this.variables = new Map();
        this.functions = new Map([
            ["print(object)", 
              {   
                isConstructor: false, 
                identity: {signature: {name: "print", parameters: [CLASS("object")]}, 
                            returnType: NONE},
                func: this.print
              }
            ],
            ["abs(number)", 
              {
                  isConstructor: false,
                  identity: {signature: {name: "abs", parameters: [NUM]}, returnType: NUM},
                  func: this.abs
              }
            ],
            ["min(number, number)", 
              {
                  isConstructor: false,
                  identity: {signature: {name: "min", parameters: [NUM, NUM]}, returnType: NUM},
                  func: this.min
              }
            ],
            ["max(number, number)", 
              {
                  isConstructor: false,
                  identity: {signature: {name: "max", parameters: [NUM, NUM]}, returnType: NUM},
                  func: this.max
              }
            ],
            ["pow(number, number)", 
              {
                  isConstructor: false,
                  identity: {signature: {name: "pow", parameters: [NUM, NUM]}, returnType: NUM},
                  func: this.pow
              }
            ]               
        ]);
    }

    private stringtify(addr: number) : string {
        if(addr === 0 ){
            return "None";
        }

        const instance = this.allocator.getInstance(addr);
        switch(instance.tag){
            case "bool": return instance.value ? "True" : "False";
            case "int": return instance.value.toString();
            case "string": return instance.value;
            case "instance": return `Instance of typecode=${instance.moduleCode}.${instance.typeCode}, 
                                        attrs count ${instance.attrs.length}`;
        }
    }

    print(... args:  number[]) : number{
        console.log(this.stringtify(args[0]));
        return args[0];
    }

    abs (... args:  number[]) : number{
        const target = this.allocator.getInstance(args[0]);
        if(target.tag === "int"){
            return this.allocator.allocInt(Math.abs(target.value));
        }
        return args[0];
    }

    min (... args:  number[]) : number{
        const left = this.allocator.getInstance(args[0]);
        const right = this.allocator.getInstance(args[1]);
        if(left.tag === "int" && right.tag === "int"){
            return left.value < right.value ? args[0] : args[1];
        }
        return args[0];
    }

    max (... args:  number[]) : number{
        const left = this.allocator.getInstance(args[0]);
        const right = this.allocator.getInstance(args[1]);
        if(left.tag === "int" && right.tag === "int"){
            return left.value > right.value ? args[0] : args[1];
        }
        return args[0];
    }

    pow (... args:  number[]) : number{
        const left = this.allocator.getInstance(args[0]);
        const right = this.allocator.getInstance(args[1]);
        if(left.tag === "int" && right.tag === "int"){
            return this.allocator.allocInt(Math.pow(left.value, right.value));
        }
        return args[0];
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