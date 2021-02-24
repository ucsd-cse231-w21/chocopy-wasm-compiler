import { Value, Type, TaggedType, ClassType } from "./ast";

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

export const NUM: Type = new TaggedType("number");
export const BOOL: Type = new TaggedType("bool");
export const NONE: Type = new TaggedType("none");
export function CLASS(name: string): Type {
  return new ClassType(name);
}
