import { BasicREPL } from "./repl";
import { Type, Value } from "./ast";
import { defaultTypeEnv } from "./type-check";
import { NUM, BOOL, NONE, PyValue } from "./utils";

import CodeMirror from "codemirror";
import "codemirror/addon/edit/closebrackets";
import "codemirror/mode/python/python";

import "./style.scss";

function stringify(result: Value): string {
  switch (result.tag) {
    case "num":
      return result.value.toString();
    case "bool":
      return result.value ? "True" : "False";
    case "none":
      return "None";
    case "object":
      return `<${result.name} object at ${result.address}`;
    default:
      throw new Error(`Could not render value: ${result}`);
  }
}

function print(typ: Type, arg: number, mem: any): any {
  console.log("Logging from WASM: ", arg);
  const elt = document.createElement("pre");
  document.getElementById("output").appendChild(elt);
  const val = PyValue(typ, arg, mem);
  elt.innerText = stringify(val); // stringify(typ, arg, mem);
  return arg;
}

function webStart() {
  document.addEventListener("DOMContentLoaded", function () {
    var importObject = {
      imports: {
        print: (arg: any) => print(NUM, arg, new Uint32Array(repl.importObject.js.memory.buffer)),
        print_num: (arg: number) =>
          print(NUM, arg, new Uint32Array(repl.importObject.js.memory.buffer)),
        print_bool: (arg: number) =>
          print(BOOL, arg, new Uint32Array(repl.importObject.js.memory.buffer)),
        print_none: (arg: number) =>
          print(NONE, arg, new Uint32Array(repl.importObject.js.memory.buffer)),
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
      document.getElementById("output").appendChild(elt);
      elt.innerText = stringify(result);
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
    setupRepl();
  });

  window.addEventListener("load", (event) => {
    const textarea = document.getElementById("user-code") as HTMLTextAreaElement;
    const editor = CodeMirror.fromTextArea(textarea, {
      mode: "python",
      theme: "neo",
      lineNumbers: true,
      autoCloseBrackets: true,
    });

    console.log(editor);

    editor.on("change", (cm, change) => {
      textarea.value = editor.getValue();
    });
  });
}

webStart();
