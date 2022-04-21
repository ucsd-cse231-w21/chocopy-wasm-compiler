// import {BasicREPL} from './repl';

// import { NUM, BOOL, NONE } from './utils';

// function stringify(typ: Type, arg: any) : string {
//   switch(typ.tag) {
//     case "number":
//       return (arg as number).toString();
//     case "bool":
//       return (arg as boolean)? "True" : "False";
//     case "none":
//       return "None";
//     case "class":
//       return typ.name;
//   }
// }

// function print(typ: Type, arg : number) : any {
//   console.log("Logging from WASM: ", arg);
//   const elt = document.createElement("pre");
//   document.getElementById("output").appendChild(elt);
//   elt.innerText = stringify(typ, arg);
//   return arg;
// }

// var importObject = {
//   imports: {
//     print_num: (arg: number) => print(NUM, arg),
//     print_bool: (arg: number) => print(BOOL, arg),
//     print_none: (arg: number) => print(NONE, arg),
//     abs: Math.abs,
//     min: Math.min,
//     max: Math.max,
//     pow: Math.pow
//   },
// };

// var repl = new BasicREPL(importObject);
// repl.run