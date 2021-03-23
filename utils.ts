import { Value, Type } from "./ast";
import { TAG_BIGINT } from "./alloc";
import * as BaseException from "./error";

export const nTagBits = 1;
export const INT_LITERAL_MAX = BigInt(2 ** (31 - nTagBits) - 1);
export const INT_LITERAL_MIN = BigInt(-(2 ** (31 - nTagBits)));

export function bigintToWords(num: bigint): [number, number, Array<bigint>] {
  const mask = BigInt(0x7fffffff);
  var sign = 1;
  var size = 0;
  // fields ? [(0, sign), (1, size)]
  if (num < 0n) {
    sign = 0;
    num *= -1n;
  }
  var words: bigint[] = [];
  do {
    words.push(num & mask);
    console.log("j");
    num >>= 31n;
    size += 1;
  } while (num > 0n);
  // size MUST be > 0
  return [sign, size, words];
}

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

export function encodeValue(
  val: Value,
  allocFun: (tag: number, size: number) => number,
  mem: any
): number {
  switch (val.tag) {
    case "num":
      console.log(val.value);
      if (val.value <= INT_LITERAL_MAX && val.value >= INT_LITERAL_MIN) {
        return ((Number(val.value) << nTagBits) & 0xffffffff) | 1;
      }
      var [sign, size, words] = bigintToWords(val.value);
      var allocPointer = allocFun(Number(TAG_BIGINT), 4 * (2 + size));
      var idx = allocPointer / 4;
      mem[idx] = sign & 0xffffffff;
      mem[idx + 1] = size & 0xffffffff;
      var i = 0;
      while (i < size) {
        mem[idx + 2 + i] = ((Number(words[i]) << nTagBits) & 0xffffffff) | 1;
        i += 1;
      }
      console.log(idx, mem.slice(idx, idx + 64));

      return allocPointer;

    case "bool":
      if (val.value == true) return 0x3;
      else return 0x1;

    default:
      throw new Error(`Could not encode value`);
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
        console.log("pybigint", num, idx);
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
