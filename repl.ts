import wabt from 'wabt';
import * as compiler from './compiler';
import { MemoryManager } from './memory';
import { EnvManager } from "./env";
import { Type } from "./ast";
import { parse } from "./parser";
import { tcProgram } from './typechecker';


export class BasicREPL {
  importObject: any;
  memoryManager: MemoryManager = new MemoryManager();
  envManager: EnvManager = new EnvManager();

  constructor(importObject: any) { 
    this.importObject = importObject;
    this.importObject.js = { memory: this.memoryManager.memory };

    (window as any)["wasmMemory"] = new Int32Array(this.memoryManager.memory.buffer);
  }

  async run(source: string): Promise<any> {
    const wabtInterface = await wabt();

    const compileResult = compiler.compile(source, this.importObject, this.memoryManager, this.envManager);
    const wasmSource = compileResult.wasmSource;

    const myModule = wabtInterface.parseWat("test.wat", wasmSource);
    var asBinary = myModule.toBinary({});
    var wasmModule = await WebAssembly.instantiate(asBinary.buffer, this.importObject);
    const result = await (wasmModule.instance.exports.exported_func as any)();
    
    return result
  }

  async tc(source: string): Promise<Type> {
    const prog = parse(source);
    tcProgram(prog, this.memoryManager, this.envManager);
    console.log(prog.stmts.length);
    if (prog.stmts.length == 0) {
      return {tag: "none"}; 
    }

    const lastStmt = prog.stmts[prog.stmts.length-1];
    if (lastStmt.tag === "expr") {
      if (lastStmt.type) {
        let name = lastStmt.type.getName();
        if (name == "bool") {
          return {tag: "bool"};
        } else if (name == "int") {
          return {tag: "number"};
        } else if (name == "<None>") {
          return {tag: "none"};
        } else {
          return {tag: "class", name: name}
        } 
      }
    }
    return {tag: "none"};
  }
}