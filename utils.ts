import { Value, Type } from "./ast";

export function stringify(result: Value) : string {
    switch(result.tag) {
        case "num":
            return result.value.toString();
        case "string":
            return result.value;
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
      return PyInt(result);
    case "string":
      if (result == -1) throw new Error("String index out of bounds");
      result = result + 4;
      let ascii_val = mem[result / 4];
      var i = 1;
      var full_string = "";
      while (ascii_val != 0) {
        var char = String.fromCharCode(ascii_val);
        full_string += char;
        ascii_val = mem[result / 4 + i];
        i += 1;
      }
      return PyString(full_string);
    case "bool":
      return PyBool(Boolean(result));
    case "class":
      return PyObj(typ.name, result);
    case "none":
      return PyNone();
    default:
      unhandledTag(typ);
  }
}

export function PyString(s: string): Value {
  return { tag: "string", value: s };
}

export function PyInt(n: number): Value {
  return { tag: "num", value: BigInt(n) };
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

export function isTagged<
  A extends string[],
  V extends { tag: string },
  T extends { tag: A[number] }
>(val: V | T, set: readonly [...A]): val is T {
  return set.includes(val.tag);
}

export function unreachable(arg: never): never {
  throw new Error(`Hit unreachable state. Got value ${JSON.stringify(arg)}`);
}

/**
 * Throw an error when an object is not handled in a switch statement
 * @param arg Tagged object which is not handled
 */
export function unhandledTag(arg: { tag: string }): never {
  throw new Error(`Node tagged with ${arg.tag} is not handled.\n\n${JSON.stringify(arg)}`);
}

export const NUM: Type = { tag: "number" };
export const STRING: Type = { tag: "string" };
export const BOOL: Type = { tag: "bool" };
export const NONE: Type = { tag: "none" };
export function CLASS(name: string): Type {
  return { tag: "class", name };
}
