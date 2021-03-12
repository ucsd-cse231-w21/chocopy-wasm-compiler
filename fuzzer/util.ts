import { Type } from "../ast";

export function convertStrToType(key: string, className?: string): Type {
  if (key.includes("class")) {
    return { tag: "class", name: className !== undefined ? className : key };
  }

  switch (key) {
    case "number":
      return { tag: "number" };
    case "bool":
      return { tag: "bool" };
    case "none":
      return { tag: "none" };
    case undefined:
      return { tag: "none" };
    default:
      return { tag: "class", name: className !== undefined ? className : key };
  }
}

export function convertTypeToStr(type: Type): string {
  if (!type) return "none";

  var typeString: string = type.tag;
  if (type.tag == "class") {
    typeString = type.name;
  }
  return typeString;
}

export function convertStrToPythonType(typeStr: string): string {
  switch (typeStr) {
    case "number":
      return "int";
    case "bool":
      return "bool";
    case "none":
      return "None";
    default:
      return typeStr;
  }
}

export function convertTypeToPythonType(type: Type): string {
  switch (type.tag) {
    case "number":
      return "int";
    case "bool":
      return "bool";
    case "none":
      throw new Error(`Unknown type from key: ${type.tag}`);
    case "class":
      return type.name;
  }
}

export function cleanProgram(program: Array<string>): string {
  return program
    .join("\n")
    .split("\n")
    .filter((block) => {
      return block.trim() != "";
    })
    .join("\n");
}
