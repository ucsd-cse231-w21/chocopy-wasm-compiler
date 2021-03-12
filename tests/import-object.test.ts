import { Type } from "../ast";
import { Config } from "../repl";
import { MainAllocator } from "../heap";
import { initializeBuiltins } from "../builtins/modules";
import { NUM, BOOL, NONE, unhandledTag } from "../utils";

function stringify(typ: Type, arg: any): string {
  switch (typ.tag) {
    case "number":
      return (arg as number).toString();
    case "bool":
      return (arg as boolean) ? "True" : "False";
    case "none":
      return "None";
    case "class":
      return typ.name;
    default:
      unhandledTag(typ);
  }
}

function print(typ: Type, arg: any): any {
  importObject.output += stringify(typ, arg);
  importObject.output += "\n";
  return arg;
}

export const importObject: {config: Config, output: string} = function () : {config: Config, output: string} {
  const allocator = new MainAllocator();
  const builtins = initializeBuiltins(allocator);
  allocator.initGlobalVars(builtins.modules.size);

  const config: Config = {builtIns: builtins.modules, 
                          builtInPresenters: builtins.presenters, 
                          allocator: allocator};
  return {config: config, output: ""};
}();

/*
{
  imports: {
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
    print: (arg: any) => print(NUM, arg),
    print_num: (arg: number) => print(NUM, arg),
    print_bool: (arg: number) => print(BOOL, arg),
    print_none: (arg: number) => print(NONE, arg),
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
  },

  output: "",
};
*/