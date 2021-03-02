import { Expr, Type } from "./ast";

export function transformComprehension(comprehension: Expr<Type>): Expr<Type> {
  if (comprehension.tag !== "comprehension") {
    throw new Error("Expected a comprehension expression");
  }

  // TODO: Fully implement this function once we have some of the other parts of the compiler working
  // Ensure iter: is a function call to range
  if (comprehension.iter.tag !== "call" || comprehension.iter.name !== "range") {
    throw new Error("Unsupported iterable for comprehension");
  }

  if (!comprehension.hasOwnProperty("cond")) {
    // No condition was provided, so default true
    return comprehension.iter;
  } else {
    // Ensure given condition is a literal bool
    let cond = comprehension.cond;
    if (cond.tag !== "literal" || cond.value.tag !== "bool") {
      throw new Error("Unsupported condition for comprehension");
    }

    if (cond.value.value) {
      // Given condition is a literal true boolean
      // so we just return the iter
      return comprehension.iter;
    } else {
      // Given condition is a literal false boolean
      // so we just return an empty range: "range(0, 0)"
      return {
        a: {
          tag: "class",
          name: "Range",
        },
        tag: "call",
        name: "range",
        arguments: [
          { a: { tag: "number" }, tag: "literal", value: { tag: "num", value: BigInt(0) } },
          { a: { tag: "number" }, tag: "literal", value: { tag: "num", value: BigInt(0) } },
        ],
      };
    }
  }
}
