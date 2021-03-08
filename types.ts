import { type } from "cypress/types/jquery";
import { Func } from "mocha";
import { Module } from "webpack";
import { Class, FunDef, VarInit , Stmt, Type, typeToString, Literal, Value} from "./ast";

/**
 * Represents a program that has been typechecked
 * and organized
 */
export type OrganizedModule = {
    imports: Array<Stmt<null>>,
    fileVars: Map<string, VarInit<Type>>,
    fileFunctions: Map<string, OrganizedFunc>,
    fileClasses: Map<string, OrganizedClass>,
    topLevelStmts: Array<Stmt<Type>>,
    presented: ModulePresenter
}

export type OrganizedFunc = {
    identity: FuncIdentity,
    params: Map<string, Type>,
    vars: Map<string, VarInit<Type>>,
    stmts: Array<Stmt<Type>>
}

export type OrganizedClass = {
    name: string, 
    fields: Map<string, VarInit<Type>>,
    methods: Map<string, OrganizedFunc>,
    presenter: ClassPresenter
}

export type FuncSignature = {
    name: string,
    parameters: Array<Type>
}

export type FuncIdentity = {
    signature: FuncSignature,
    returnType: Type
}

export type ModulePresenter = {
    moduleVars: Map<string, Type>,
    functions: Map<string, FuncIdentity>,
    classes: Map<string, ClassPresenter>
}

export type ClassPresenter = {
    name: string,
    instanceVars: Map<string, {type: Type, initValue?: Literal}>,
    instanceMethods: Map<string, FuncIdentity>
}

export function fdefToIdentity(def: FunDef<null>) : FuncIdentity{
    const result: FuncIdentity = {
        signature: {name: def.name, parameters: def.parameters.map(x => x.type)},
        returnType: def.ret
    };

    return result;
}

export function fdefToSigStr(def: FunDef<null>) : string {
    return `${def.name}(${def.parameters.map( x => typeToString(x.type)).join(",")})`;
}

export function idenToStr(iden: FuncIdentity) : string {
    return `${iden.signature.name}(${iden.signature.parameters.map( x => typeToString(x)).join(",")})`;
}

export function fdefToTypeStr(def: FunDef<null>) : string {
    return typeToString({tag: "callable", args: def.parameters.map(x=>x.type), ret: def.ret});
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
