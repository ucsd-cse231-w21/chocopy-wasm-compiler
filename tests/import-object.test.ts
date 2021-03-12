import { Type } from "../ast";
import { NUM, BOOL, NONE, unhandledTag } from "../utils";
import * as numpy from "../numpy";
import * as compiler from "../compiler";

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

function print_lists(lists: number) {
  const listContent = compiler.tsHeap[lists];
  // TODO: overwrite this by list team?
  // assume lists are stored in TS heap; flattened already; number element
  if (listContent instanceof Array){
    listContent.forEach( (e: number) => {
      print(NUM, e);
    });
  }else {
    print(NUM, listContent);
  }
}

// TODO: add more imported functions/methods here
// unknown errors of importing importFuns from ../webstart?
export const importFuns = {
  print_lists: print_lists,
  numpy_ndarray_flatten: numpy.ndarray_flatten,
  numpy_ndarray_tolist: numpy.ndarray_tolist,
  numpy_ndarray_add: numpy.ndarray_add,
  numpy_ndarray_dot: numpy.ndarray_dot,
  numpy_ndarray_divide: numpy.ndarray_divide,
  numpy_ndarray_subtract: numpy.ndarray_subtract,
  numpy_ndarray_multiply: numpy.ndarray_multiply,
  numpy_ndarray_pow: numpy.ndarray_pow,
}

export const importObject = {
  imports: {
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
    ...importFuns,
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
