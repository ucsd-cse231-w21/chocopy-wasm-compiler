// -*- mode: typescript; typescript-indent-level: 2; -*-

import {BasicREPL} from './repl';
import {emptyEnv} from './compiler';
import {GlobalEnv} from './env';
import {Value, Type} from './ast';
import {valueToStr, i64ToValue, NONE_BI} from './common';
import {prettifyWasmSource} from './linter';

import {NUM, BOOL, NONE} from './utils';

import * as ace from 'brace';
import 'brace/mode/python';
import 'brace/theme/monokai';

import * as strEx from './py_examples/string_ex.py';
import * as cnEx from './py_examples/complex_number_ex.py';
import * as vecEx from './py_examples/vector_ex.py';
import * as patEx from './py_examples/pattern_print_ex.py';
import * as testEx from './py_examples/test_ex.py';

var editor: ace.Editor = undefined;

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
  }
}

function registerDialogs() {
  const aboutModal = document.getElementById("aboutModal");
  
  const aboutBtn = document.getElementById("aboutBtn");

  // Get the <span> element that closes the aboutModal
  const aboutCloseBtn = document.getElementById("closeAboutModal");
  

  // When the user clicks on the button, open the aboutModal
  aboutBtn.addEventListener("click", function() {
    aboutModal.style.display = "block";
  });

  aboutCloseBtn.addEventListener("click", function() {
    aboutModal.style.display = "none";
  });

  window.addEventListener("click", function(event) {
    if (event.target == aboutModal) {
      aboutModal.style.display = "none";
    }
  });
}

function webStart() {
  document.addEventListener("DOMContentLoaded", function() {
    registerDialogs();
    editor = ace.edit("user-code"); // sourceElem.value.replace(/\t/g, '    ');
    editor.setTheme("ace/theme/textmate");
    editor.session.setMode("ace/mode/python");

    document.getElementById("pattern-print").addEventListener("click", function() {
      editor.setValue(patEx.default, -1);
    });

    document.getElementById("ex-list").addEventListener("click", function() {
      editor.setValue(vecEx.default, -1);
    });
    
    document.getElementById("ex-complex-number").addEventListener("click", function() {
      editor.setValue(cnEx.default, -1);
    });
    
    document.getElementById("test-python").addEventListener("click", function() {
      editor.setValue(testEx.default, -1);
    });
    
    document.getElementById("ex-string").addEventListener("click", function() {
      editor.setValue(strEx.default, -1);
    });
    
    var importObject = {
      imports: {
	print_other: (arg: any) => {
	  const res = i64ToValue(arg, this.importObject.tableOffset);
	  console.log("From print_other");
	  console.log(res);
	  if (res.tag == "bool") {
	    this.print_bool(res.value);
	    return NONE_BI;
	  } else if (res.tag == "num") {
	    const typ: Type = {tag: "number"};
	    const val = res.value;
	    this.print_num(val);
	    return NONE_BI;
	  } else if (res.tag == "none") {
	    this.print_none(undefined);
	    return NONE_BI;
	  } else if (res.tag == "str") {
	    return this.print_str(res.off);
	  }else {
	    this.print({tag: res.tag} , undefined);
	    return NONE_BI;
	  }
	},
	print_num: (arg: number) => importObject.imports.print(NUM, arg),
	print_bool: (arg: number) => importObject.imports.print(BOOL, arg),
	print_none: (arg: number) => importObject.imports.print(NONE, arg),
	print_obj : (arg : any, classId: any) => {
	  const classObj: Value = {tag: "object", name: importObject.tableOffset.get(Number(classId)), address: arg};
	  const str = valueToStr(classObj);


          return this.print(str);
	},
	imported_func: (arg : any) => {
          console.log("Logging from WASM: ", arg);
          const elt = document.createElement("pre");
          document.getElementById("output").appendChild(elt);
          elt.innerText = arg;
        },
	print: (typ: Type, arg : any): any => {
          const elt = document.createElement("pre");
          document.getElementById("output").appendChild(elt);
          elt.innerText = stringify(typ, arg);

	  return NONE_BI;
        },

        print_global_func: (pos: number, value: number) => {
          var name = importObject.nameMap[pos];
          var msg = name + " = " + value;
          renderResult(msg);
        },
	
	assert_non_none: (arg: any) : any => {
	  const res = i64ToValue(arg, this.importObject.tableOffset);
	  if (res.tag == "none") {
	    throw new Error("Operation on None");
	  }
	  return arg;
	},
	
	print_txt: (arg: any) => {
	  const elt = document.createElement("pre");
	  document.getElementById("output").appendChild(elt);
	  elt.innerText = arg;
	},


      },
      nameMap: new Array<string>(),
      tableOffset: new Map<number, string>(),
      
      updateNameMap : (env : GlobalEnv) => {
        env.globals.forEach((pos, name) => {
          importObject.nameMap[pos[1]] = name;
        })
      },
      
      updateTableMap : (env : GlobalEnv) => {
        env.classes.forEach((val, key) => {
	  console.log("setting tableOffset");
          importObject.tableOffset.set(val.tableOff, key);
        })
      }

    };

    const env = emptyEnv;
    var repl = new BasicREPL(importObject);

    function renderResult(result : any) : void {
      if (result === undefined || result == "None") {
	console.log("skip"); return;
      }
      
      const elt = document.createElement("pre");
      document.getElementById("output").appendChild(elt);
      elt.innerText = String(result);
    }

    function showSource(compiled: string): void {
      console.log("showing source");
      console.log(prettifyWasmSource(compiled));

      const compiledHtml = prettifyWasmSource(compiled).replace(/\n/g, "<br>").replace(/ /g, "&nbsp;");
      document.getElementById("outputSource").innerHTML = compiledHtml;
    }

    function renderError(result : any) : void {
      const elt = document.createElement("pre");
      document.getElementById("output").appendChild(elt);
      elt.setAttribute("style", "color: red");
      elt.innerText = String(result);
    }


    function setupRepl() {
      document.getElementById("output").innerHTML = "";
      const replCodeElement = document.getElementById("next-code") as HTMLInputElement;
      replCodeElement.addEventListener("keypress", (e) => {
        if(e.key === "Enter" && !(e.shiftKey)) {
	  e.preventDefault();
	  
          const output = document.createElement("div");
          const prompt = document.createElement("span");
          prompt.innerText = "»";
          output.appendChild(prompt);
          const elt = document.createElement("textarea");
          // elt.type = "text";
          elt.disabled = true;
          elt.className = "repl-code";
          output.appendChild(elt);
          document.getElementById("output").appendChild(output);
          const source = replCodeElement.value;
          elt.value = source;
          replCodeElement.value = "";
          repl.run(source).then((r) => { renderResult(valueToStr(r[0])); console.log ("run finished") })
              .catch((e) => { renderError(e); console.log("run failed", e) });;
        }
      });
    }


    document.getElementById("run").addEventListener("click", function(e) {
      repl = new BasicREPL(importObject);

      // const sourceElem = document.getElementById("user-code") as HTMLTextAreaElement;
      const sourceElem = document.getElementById("user-code") as HTMLTextAreaElement;
      // const source = sourceElem.value.replace(/\t/g, '    ');
      const source = editor.getValue();
      setupRepl();
      //   const output = document.getElementById("output").innerHTML = "";
      repl.run(source).then((result) => {
	const r = result[0];
	const compiled = result[1];
	renderResult(valueToStr(r)); console.log ("run finished")
	showSource(compiled);
      }).catch((e) => { renderError(e); console.log("run failed", e) });;
    });
  });
}

webStart();
