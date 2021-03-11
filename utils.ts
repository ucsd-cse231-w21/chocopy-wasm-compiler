import { Value, Type } from "./ast";

export function PyValue(typ: Type, result: number): Value {
  switch (typ.tag) {
    case "number":
      return PyInt(result);
    case "bool":
      return PyBool(Boolean(result));
    case "class":
      return PyObj(typ.name, result);
    case "none":
      return PyNone();
    case "list":
      return PyList(result);
    default:
      unhandledTag(typ);
  }
}

export function PyInt(n: number): Value {
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

// TODO: overwrite this by list team
export function PyList(address: number): Value {
  return { tag: "list", address, content_type: NUM };
}

export function isTagged<
  A extends string[],
  V extends { tag: string },
  T extends { tag: A[number] }
>(val: V | T, set: readonly [...A]): val is T {
  return set.includes(val.tag);
}

export function unreachable(arg: never): never {
  throw new Error(`Hit unreachable state. Got value ${jsonStringify(arg)}`);
}

/**
 * Throw an error when an object is not handled in a switch statement
 * @param arg Tagged object which is not handled
 */
export function unhandledTag(arg: { tag: string }): never {
  throw new Error(`Node tagged with ${arg.tag} is not handled.\n\n${jsonStringify(arg)}`);
}

export const NUM: Type = { tag: "number" };
export const BOOL: Type = { tag: "bool" };
export const NONE: Type = { tag: "none" };
export function CLASS(name: string): Type {
  return { tag: "class", name };
}
export const LIST: Type = { tag: "list", content_type: NUM }; // TODO: overwrite this by list team

export function jsonStringify(data: any) : string {
  // JSON.stringify() with bigint support 
  // reference: https://stackoverflow.com/questions/58249954/json-stringify-and-postgresql-bigint-compliance
  return JSON.stringify(data, (_, v) => typeof v === 'bigint' ? `${v}#bigint` : v)
      .replace(/"(-?\d+)#bigint"/g, (_, a) => a);
}

// special delimiters for importobjects call in ts
// TODO: update these delimiters to be unique from python syntax
export const importMethodDel : string = "_"; // eg numpy.mean <=> numpy_mean
export const importDel : string = "_"; // eg numpy.ndarray <=> numpy_ndarray 