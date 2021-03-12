import { Value, Type } from "./ast";
import { nTagBits } from "./compiler";
import * as BaseException from "./error";

export function stringify(result: Value): string {
  switch (result.tag) {
    case "num":
      return result.value.toString();
    case "string":
      return result.value;
    case "bool":
      return result.value ? "True" : "False";
    case "none":
      return "None";
    case "object":
      return `<${result.name} object at ${result.address}>`;
    default:
      throw new BaseException.InternalException(`Could not render value: ${result}`);
  }
}

export function PyValue(typ: Type, result: number, mem: any): Value {
  switch (typ.tag) {
    case "string":

      if (result == -1) throw new BaseException.InternalException("String index out of bounds");
      if (result == -2) throw new BaseException.InternalException("Slice step cannot be zero");

      const view = new Int32Array(mem);
      let string_length = view[result / 4] + 1;
      let data = result + 4;
      var i = 0;
      var full_string = "";
      while (i < string_length) {
        let ascii_val = view[data / 4 + i];
        var char = String.fromCharCode(ascii_val);
        full_string += char;
        i += 1;
      }
      return PyString(full_string, result);
    case "number":
      // console.log("Actual length "+result);
      if (result & 1) {
        // console.log("Printed length "+BigInt(result >> nTagBits));
        return PyInt(result >> nTagBits);
      } else {
        var idx: number = Number(result) / 4;
        var sign = mem[idx];
        var size = mem[idx + 1];
        var i = 1;
        var num = 0n;
        while (i <= size) {
          var dig = mem[idx + 1 + i];
          num += BigInt(dig >>> nTagBits) << BigInt((i - 1) * (32 - nTagBits));
          i += 1;
        }
        if (!sign) num = -num;
        return PyBigInt(num);
      }
    case "bool":
      return PyBool(Boolean(result >> nTagBits));
    case "class":
      return PyObj(typ.name, result);
    case "none":
      return PyNone();
    case "list":
      return PyObj(typ.tag + `<${typ.content_type.tag}>`, result);
    default:
      unhandledTag(typ);
  }
}

export function PyString(s: string, address: number): Value {
  return { tag: "string", value: s, address: address };
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

export type WithTag<O, T> = O extends { tag: T } ? O : never;

export function isTagged<
  A extends string[],
  V extends { tag: string },
  T extends { tag: A[number] }
>(val: V | T, set: readonly [...A]): val is T {
  return set.includes(val.tag);
}

export function unreachable(arg: never): never {
  throw new BaseException.InternalException(
    `Hit unreachable state. Got value ${JSON.stringify(arg)}`
  );
}

/**
 * Throw an error when an object is not handled in a switch statement
 * @param arg Tagged object which is not handled
 */
export function unhandledTag(arg: { tag: string }): never {
  throw new BaseException.InternalException(
    `Node tagged with ${arg.tag} is not handled.\n\n${JSON.stringify(arg)}`
  );
}

export const NUM: Type = { tag: "number" };
export const STRING: Type = { tag: "string" };
export const BOOL: Type = { tag: "bool" };
export const NONE: Type = { tag: "none" };
export function LIST(type: Type): Type {
  return { tag: "list", content_type: type };
}
export function CLASS(name: string): Type {
  return { tag: "class", name };
}
export function TUPLE(...types: Array<Type>): Type {
  return { tag: "tuple", contentTypes: types };
}

export function CALLABLE(args: Array<Type>, ret: Type): Type {
  const params = args.map((t, i) => ({ name: `callable_${i}`, type: t }));
  return { tag: "callable", args: params, ret };
}
