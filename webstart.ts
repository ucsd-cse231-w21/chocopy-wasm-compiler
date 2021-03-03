import { BasicREPL } from "./repl";
import { Type, Value } from "./ast";
import { NUM, BOOL, NONE, unhandledTag } from "./utils";
import { themeList_export } from "./themelist"

import CodeMirror from "codemirror"
import "codemirror/addon/edit/closebrackets"
import "codemirror/mode/python/python"
import "codemirror/addon/hint/show-hint"
import "codemirror/addon/lint/lint"
import "./style.scss";
import { toEditorSettings } from 'typescript';

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

function print(typ: Type, arg: number): any {
  console.log("Logging from WASM: ", arg);
  const elt = document.createElement("pre");
  document.getElementById("output").appendChild(elt);
  elt.innerText = stringify(typ, arg);
  return arg;
}

function webStart() {
  document.addEventListener("DOMContentLoaded", function () {
    var importObject = {
      imports: {
        print_num: (arg: number) => print(NUM, arg),
        print_bool: (arg: number) => print(BOOL, arg),
        print_none: (arg: number) => print(NONE, arg),
        abs: Math.abs,
        min: Math.min,
        max: Math.max,
        pow: Math.pow,
      },
    };

    var repl = new BasicREPL(importObject);

    function renderResult(result: Value): void {
      if (result === undefined) {
        console.log("skip");
        return;
      }
      if (result.tag === "none") return;
      const elt = document.createElement("pre");
      elt.setAttribute("title", result.tag);
      document.getElementById("output").appendChild(elt);
      switch (result.tag) {
        case "num":
          elt.innerText = String(result.value);
          break;
        case "bool":
          elt.innerHTML = result.value ? "True" : "False";
          break;
        case "object":
          elt.innerHTML = `<${result.name} object at ${result.address}`;
          break;
        default:
          throw new Error(`Could not render value: ${result}`);
      }
    }

    function renderError(result: any): void {
      const elt = document.createElement("pre");
      document.getElementById("output").appendChild(elt);
      elt.setAttribute("style", "color: red");
      elt.innerText = String(result);
    }

    function setupRepl() {
      document.getElementById("output").innerHTML = "";
      const replCodeElement = document.getElementById("next-code") as HTMLTextAreaElement;
      replCodeElement.addEventListener("keypress", (e) => {
        if (!e.shiftKey && e.key === "Enter") {
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
          repl
            .run(source)
            .then((r) => {
              renderResult(r);
              console.log("run finished");
            })
            .catch((e) => {
              renderError(e);
              console.log("run failed", e);
            });
        }
      });
    }

    function resetRepl() {
      document.getElementById("output").innerHTML = "";
    }

    document.getElementById("run").addEventListener("click", function (e) {
      repl = new BasicREPL(importObject);
      const source = document.getElementById("user-code") as HTMLTextAreaElement;
      resetRepl();
      repl
        .run(source.value)
        .then((r) => {
          renderResult(r);
          console.log("run finished");
        })
        .catch((e) => {
          renderError(e);
          console.log("run failed", e);
        });
    });

    document.getElementById("reset").addEventListener("click", function(e){
      //clears repl output
      resetRepl();
      //resets environment
      repl = new BasicREPL(importObject);
      //clear editor
      var element = document.querySelector(".CodeMirror")  as any;
      var editor = element.CodeMirror;
      editor.setValue("");
      editor.clearHistory();
    })
    setupRepl();
  });

  window.addEventListener('load', (event) => {
    const themeList = themeList_export;
    const dropdown = document.createElement("select");
    dropdown.setAttribute("class", "theme-dropdown");
    dropdown.setAttribute("id", "theme-dropdown");

    for (const theme of themeList){
      var option = document.createElement("option");
      option.value = theme;
      option.text = theme;
      dropdown.appendChild(option);
    }


    document.getElementById("editor").appendChild(dropdown)
    const textarea = document.getElementById("user-code") as HTMLTextAreaElement;
    const editor = CodeMirror.fromTextArea(textarea, {
        mode: "python",
        theme: "neo",
        lineNumbers: true,
        autoCloseBrackets: true,
        lint: true,
        gutters: ["error"], 
        extraKeys: {
          "Ctrl+Space" : "autocomplete"
        },
        hintOptions: {
          alignWithWord: false,
          completeSingle: false,
        },
    });

    editor.on("change", (cm, change) => {
        textarea.value = editor.getValue();
    })
    editor.on('inputRead', function onChange(editor, input) {
      if (input.text[0] === ';' || input.text[0] === ' ' || input.text[0] === ":") {
          return;
      }
      editor.showHint({
        // hint: 
      });
    });

    var themeDropDown = document.getElementById("theme-dropdown") as HTMLSelectElement;
    themeDropDown.addEventListener("change", (event) => {
      var ele = document.querySelector(".CodeMirror") as any;
      var editor = ele.CodeMirror; 
      editor.setOption("theme", themeDropDown.value);
    });
  });


}
// Simple helper to highlight line given line number
function highlightLine(actualLineNumber: number) : void {
  var ele = document.querySelector(".CodeMirror") as any;
  var editor = ele.CodeMirror; 
  //Set line CSS class to the line number & affecting the background of the line with the css class of line-error
  editor.setGutterMarker(actualLineNumber, 'error', makeMarker("test error message"));
  editor.addLineClass(actualLineNumber, 'background', 'line-error');
}
function makeMarker(msg:any) : any {
  const marker = document.createElement('div');
  marker.classList.add('error-marker');
  marker.innerHTML = '&nbsp;';

  const error = document.createElement('div');
  error.innerHTML = msg;
  error.classList.add('error-message');
  marker.appendChild(error);

  return marker;
}
webStart();
