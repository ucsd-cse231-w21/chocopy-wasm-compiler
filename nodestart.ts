import {run} from "./runner";
import {emptyEnv, GlobalEnv} from "./compiler";
import {BasicREPL} from "./repl";
import {Value} from './ast';
import {valueToStr, i64ToValue, NONE_BI} from './common';

const importObject = {
    imports: {
	imported_func: (arg : any) => {
	    console.log("Logging from WASM: ", arg);
	},

	print_global_func: (pos: number, value: number) => {
	    var name = importObject.nameMap[pos];
	    console.log(name, "=", value);
	},

	print: (arg: any) => {
	    console.log(arg);
	},
	print_other : (arg: any) => {
	    const str = valueToStr(i64ToValue(arg, importObject.tableOffset), importObject);
	    
	    return importObject.imports.print(str);
	},
	print_obj : (arg : any, classId: any) => {
	    const classObj: Value = {tag: "object", name: importObject.tableOffset.get(Number(classId)), address: arg};
	    const str = valueToStr(classObj, importObject);
	    
	    
            return importObject.imports.print(str);
	},

	// print_globals_func: () => {
	//   var env : GlobalEnv = (importObject as any).env;
	//   env.globals.forEach((pos, name) => {
	//     var value = new Uint32Array((importObject as any).js.memory.buffer)[pos];
	//     console.log(name, "=", value);
	//   });
	// }
    },

    nameMap: new Array<string>(),
    tableOffset: new Map<number, string>(),
    
    updateTableMap : (env : GlobalEnv) => {
        env.classes.forEach((val, key) => {
	    console.log("setting tableOffset");
            importObject.tableOffset.set(val.tableOff, key);
        })
    },

    updateNameMap : (env : GlobalEnv) => {
	env.globals.forEach((pos, name) => {
	    importObject.nameMap[pos[1]] = name;
	})
    },
};

async function nodeStart(source : string) {
    const env = emptyEnv;
    run(source, { importObject, env });
}

nodeStart("x: int = 5\nprint(x)");


async function tryRepl() {
    const r = new BasicREPL(importObject);
    await r.run("foo: int = 1000");
    await r.run("print(foo)");
    await r.run("bar: int = 99");
    await r.run("foo: int = 50");
    await r.run("print(bar)");
    await r.run("print(bar)");
    await r.run("print(foo)");
    await r.run("print(bar)");
}
tryRepl();
