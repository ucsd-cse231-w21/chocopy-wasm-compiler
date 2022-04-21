import { BasicREPL } from "../repl";

import { Type } from "../ast";
import { importObject } from "./import-object.test";

export function typeCheck(source: string) : Type {
  const repl = new BasicREPL(importObject);
  return repl.tc(source);
}

export async function run(source: string) {
  const repl = new BasicREPL(importObject);
  const v = await repl.run(source);
}

export const NUM : Type = {tag: "number"}
export const BOOL : Type = {tag: "bool"}
export const NONE : Type = {tag: "none"}
export function CLASS(name : string) : Type { 
  return {tag: "class", name}
};