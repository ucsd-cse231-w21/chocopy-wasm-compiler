import { Type } from "../ast";

//constants
export const INDENT = "  ";
export const INNER_CLASS_LEVEL = 1;

export type Parameter = { name: string; type: Type };

export type FunDef = {
  name: string;
  parameters: Array<Parameter>;
  ret: Type;
};

export type ClassDef = {
  name: string;
  fields: Map<string, Array<string>>;
  methods: Array<FunDef>;
};

export type ProbPair = {
  prob: number;
  key: string;
};

export type Program = {
  program: Array<string>;
  lastStmt: string;
};
