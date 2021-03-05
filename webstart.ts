import { BasicREPL } from "./repl";
import { Type, Value } from "./ast";
import { NUM, STRING, BOOL, NONE, unhandledTag } from "./utils";

import CodeMirror from "codemirror";
import "codemirror/addon/edit/closebrackets";
import "codemirror/mode/python/python";

import "./style.scss";

var mem_js: { memory: any };

function stringify(typ: Type, arg: any): string {
  switch (typ.tag) {
    case "number":
      return (arg as number).toString();
    case "string":
      if (arg == -1) throw new Error("String index out of bounds");
      const view = new Int32Array(mem_js.memory.buffer);
      let string_length = view[arg / 4] + 1;
      arg = arg + 4;
      var i = 0;
      var full_string = "";
      while (i < string_length) {
        let ascii_val = view[arg / 4 + i];
        var char = String.fromCharCode(ascii_val);
        full_string += char;
        i += 1;
      }
      return full_string;
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
    const memory = new WebAssembly.Memory({ initial: 2000, maximum: 2000 });
    const view = new Int32Array(memory.buffer);
    view[0] = 4;
    var memory_js = { memory: memory };

    var importObject = {
      imports: {
        print_num: (arg: number) => print(NUM, arg),
        print_str: (arg: number) => print(STRING, arg),
        print_bool: (arg: number) => print(BOOL, arg),
        print_none: (arg: number) => print(NONE, arg),
        abs: Math.abs,
        min: Math.min,
        max: Math.max,
        pow: Math.pow,
      },
      js: memory_js,
    };

    mem_js = importObject.js;

    var repl = new BasicREPL(importObject);

    function renderResult(result: Value): void {
      if (result === undefined) {
        console.log("skip");
        return;
      }
      if (result.tag === "none") return;
      const elt = document.createElement("pre");
      document.getElementById("output").appendChild(elt);
      switch (result.tag) {
        case "num":
          elt.innerText = String(result.value);
          break;
        case "bool":
          elt.innerHTML = result.value ? "True" : "False";
          break;
        case "object":
          if (result.name == "String") {
            elt.innerText = stringify(STRING, result.address);
          } else {
            elt.innerHTML = `<${result.name} object at ${result.address}`;
          }
          break;
        default:
          throw new Error(`Could not render value: ${result}`);
      }
    }

    function renderError(result: any, source: string): void {
      const elt = document.createElement("pre");
      document.getElementById("output").appendChild(elt);
      elt.setAttribute("style", "color: red");
      var text = "";
      if (result.loc != undefined)
        text = `line ${result.loc.line}: ${source
          .split(/\r?\n/)
          [result.loc.line - 1].substring(result.loc.col - 1, result.loc.col + result.loc.length)}`;
      elt.innerText = text.concat("\n").concat(String(result));
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
              renderError(e, source);
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
          renderError(e, source.value);
          console.log("run failed", e.stack);
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
