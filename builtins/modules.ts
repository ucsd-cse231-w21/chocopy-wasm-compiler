import {BuiltInModule, BuiltInClass, BuiltVariable, BuiltInFunction, attachPresenter, stringtify} from "./builtins";
import { ClassPresenter, FuncIdentity, idenToStr, ModulePresenter } from "../types";
import { Instance, MainAllocator } from "../heap";
import { BOOL, CLASS, NONE, NUM, STR } from "../utils";

export const SYSTEM_MODULE_NAME = "system";

/**
 * Initializes the BuiltInModules that will be available to 
 * the REPL
 * 
 * @throws Error if any two modules share the same name
 * @param allocator - the memory allocator to use for built-in modules 
 * @returns an object that holds the BuiltInModules mapping and another mapping for their presenters
 */
export function initializeBuiltins(allocator: MainAllocator) : {modules: Map<string, BuiltInModule>, 
                                                                presenters: Map<string, ModulePresenter>} {
    const modules = [new Natives(allocator), 
                     new OtherModule(allocator)];

    //attaches ModuelPresenters to the built-in module and
    //maps modules by their names
    const moduleMap = new Map<string, BuiltInModule>();
    const presentersMap = new Map<string, ModulePresenter>();
    for(let m of modules){
        if(moduleMap.has(m.name)){
            throw new Error("Duplicate module name: "+m.name);
        }
        else if(m.name === SYSTEM_MODULE_NAME){
            throw new Error(`'${SYSTEM_MODULE_NAME}' is a module name reserved for this REPL. Custom modules cannot use this name.`);
        }

        attachPresenter(m);
        presentersMap.set(m.name, m.presenter);
        moduleMap.set(m.name, m);
    }

    return {modules: moduleMap, presenters: presentersMap};
}


class Natives extends BuiltInModule{
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
                func: this.print.bind(this)
              }
            ],
            ["abs(number)", 
              {
                  isConstructor: false,
                  identity: {signature: {name: "abs", parameters: [NUM]}, returnType: NUM},
                  func: this.abs.bind(this)
              }
            ],
            ["min(number, number)", 
              {
                  isConstructor: false,
                  identity: {signature: {name: "min", parameters: [NUM, NUM]}, returnType: NUM},
                  func: this.min.bind(this)
              }
            ],
            ["max(number, number)", 
              {
                  isConstructor: false,
                  identity: {signature: {name: "max", parameters: [NUM, NUM]}, returnType: NUM},
                  func: this.max.bind(this)
              }
            ],
            ["pow(number, number)", 
              {
                  isConstructor: false,
                  identity: {signature: {name: "pow", parameters: [NUM, NUM]}, returnType: NUM},
                  func: this.pow.bind(this)
              }
            ]               
        ]);
    }

    print(... args:  number[]) : number{
        console.log(stringtify(this.allocator, args[0]));
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
            return this.allocator.allocInt(Math.floor(Math.pow(left.value, right.value)));
        }
        return args[0];
    }

}   


class OtherModule extends BuiltInModule {
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
        this.variables = new Map([
            ["otherVar", new BuiltVariable("otherVar", NUM)]
        ]);
        this.functions = new Map([
            ["someFunc()", {isConstructor: false, 
                            identity: {signature: {name: "someFunc", parameters: []}, 
                                       returnType: NONE},
                            func: this.someFunc.bind(this)}],
            ["someFunc(number)", {isConstructor: false, 
                            identity: {signature: {name: "someFunc", parameters: [NUM]}, 
                                        returnType: NUM},
                            func: this.someFuncOne.bind(this)}],
            ["otherFunc()", {isConstructor: false, 
                            identity: {signature: {name: "otherFunc", parameters: []}, 
                                       returnType: NONE},
                            func: this.otherFunc.bind(this)}],  
            ["otherFunc(string,number,bool)", {isConstructor: false, 
                                identity: {signature: {name: "otherFunc", parameters: [STR, NUM, BOOL]}, 
                                           returnType: STR},
                                func: this.otherFuncOne.bind(this)}],    
            ["printOtherVar()", {isConstructor: false, 
                                identity: {signature: {name: "printOtherVar", parameters: []}, 
                                            returnType: NONE},
                                func: this.printOtherVar.bind(this)}]                        
        ]);

        //set otherVar to be -20
        this.variables.get("otherVar").set(allocator.allocInt(-20));
    }

    printOtherVar(): number{
        console.log("current value of otherVar is: "+stringtify(this.allocator, this.variables.get("otherVar").get()));
        return 0;
    }

    someFunc() : number{
        console.log("in some func!");
        return 0;
    }

    someFuncOne(... args: number []) : number{
        console.log("in some func that takes an int "+stringtify(this.allocator, args[0]));
        return this.allocator.allocInt(this.allocator.getInt(args[0]) + 90);
    }

    otherFunc() : number{
        console.log("in other func!");
        return 0;
    }

    otherFuncOne(... args: number []) : number{
        console.log("in other func that takes a string, int, bool in that order!");
        console.log("  => string "+stringtify(this.allocator, args[0]))
        console.log("  => int "+stringtify(this.allocator, args[1]))
        console.log("  => bool "+stringtify(this.allocator, args[2]))
        return args[0];
    }
};