import { type } from "cypress/types/jquery";
import { Func } from "mocha";
import { Module } from "webpack";
import { Class, FunDef, VarInit , Stmt, Type, typeToString, Literal, Value} from "./ast";


export type FuncSignature = {
    name: string,
    parameters: Array<Type>
}

export type FuncIdentity = {
    signature: FuncSignature,
    returnType: Type
}

export type ModulePresenter = {
    name: string,
    moduleVars: Map<string, Type>,
    functions: Map<string, FuncIdentity>,
    classes: Map<string, ClassPresenter>
}

export type ClassPresenter = {
    name: string,
    instanceVars: Map<string, Type>,
    instanceMethods: Map<string, FuncIdentity>
}

export function idenToStr(iden: FuncIdentity) : string {
    return `${iden.signature.name}(${iden.signature.parameters.map( x => typeToString(x)).join(",")})`;
}

export function callToSignature(name: string, args: Array<Type>) : string{
    return `${name}(${args.map(x => typeToString(x)).join(",")})`;
}

export function literalToType(lit: Literal) : Type{
    switch(lit.tag){
        case "bool" : return {tag: "bool"};
        case "none" : return {tag: "none"};
        case "num" : return {tag: "number"};
        case "string": return {tag: "string"};
    }
}
