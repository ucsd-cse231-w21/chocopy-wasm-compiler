import { Value, Type } from "./ast";
import { nTagBits } from "./compiler";

export function stringify(result: Value) : string {
    switch(result.tag) {
        case "num":
            return result.value.toString();
        case "bool":
            return (result.value) ? "True" : "False";
        case "none":
            return "None";
        case "object":
            return `<${result.name} object at ${result.address}>`;
        default: throw new Error(`Could not render value: ${result}`);
    }
}

export function PyValue(typ: Type, result: number, mem: any): Value {
  switch (typ.tag) {
    case "number":
      if (result & 1) {
        return PyInt(result >> nTagBits);
      } else {
        var idx : number = Number(result) / 4;
        var sign = mem[idx];
        var size = mem[idx+1];
        var i = 1;
        var num = 0n;
        while (i <= size) {
          var dig = mem[idx+1+i];
          num += BigInt(dig >>> nTagBits) << BigInt((i - 1) * (32 - nTagBits));
          i += 1
        }
        if (!sign) num = -num
        return PyBigInt(num);
      }
    case "bool":
      return PyBool(Boolean(result >> nTagBits));
    case "class":
      return PyObj(typ.name, result);
    case "none":
      return PyNone();
  }
}

export function PyInt(n: number): Value {
  return { tag: "num", value: BigInt(n) };
}

export function PyBigInt(n: bigint): Value {
  return { tag: "num", value: n };
}

export function PyBool(b: boolean): Value {
  return { tag: "bool", value: b };
}

export function PyObj(name: string, address: number): Value {
  if (address === 0) return PyNone();
  else return { tag: "object", name, address };
}

export function PyNone(): Value {
  return { tag: "none" };
}

export function isTagged<A extends string[], V extends {tag: string}, T extends {tag: A[number]}>(val: V | T, set: readonly [...A]): val is T {
  return set.includes(val.tag);
}

export const NUM : Type = {tag: "number"};
export const BOOL : Type = {tag: "bool"};
export const NONE : Type = {tag: "none"};
export function CLASS(name : string) : Type {return {tag: "class", name}};
