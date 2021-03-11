import { BasicREPL } from "./repl";
import { Type, Value } from "./ast";
import { NUM, STRING, BOOL, NONE, PyValue, unhandledTag, stringify } from "./utils";
import { addAccordionEvent, prettyPrintObjects } from "./prettyprint";
import { defaultTypeEnv } from "./type-check";
import { themeList_export } from "./themelist";

import CodeMirror from "codemirror";
import "codemirror/addon/edit/closebrackets";
import "codemirror/mode/python/python";
import "codemirror/addon/hint/show-hint";
import "codemirror/addon/lint/lint";
import "codemirror/addon/scroll/simplescrollbars";
import "./style.scss";
import { toEditorSettings } from "typescript";
import { replace } from "cypress/types/lodash";

function print(val: Value) {
  const elt = document.createElement("pre");
  document.getElementById("output").appendChild(elt);
  elt.innerText = stringify(val); // stringify(typ, arg, mem);
}

function webStart() {
  var hiderepl = false;
  document.addEventListener("DOMContentLoaded", function () {
    var filecontent: string | ArrayBuffer;

    var importObject = {
      imports: {
        print: print,
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
      elt.innerText = stringify(result);
      prettyPrintObjects(result, repl, document.getElementById("output"));
      addAccordionEvent();
    }

    function renderError(result: any, source: string): void {
      const elt = document.createElement("pre");
      document.getElementById("output").appendChild(elt);
      elt.setAttribute("style", "color: red");
      var text = "";
      if (result.loc != undefined){
        text = `line ${result.loc.line}: ${source
          .split(/\r?\n/)
          [result.loc.line - 1].substring(result.loc.col - 1, result.loc.col + result.loc.length)}`;
      }
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
          if(e.loc != undefined)
            highlightLine(e.loc.line - 1, e.message);
          console.log("run failed", e.stack);
        });
    });

    document.getElementById("reset").addEventListener("click", function (e) {
      //clears repl output
      resetRepl();
      //resets environment
      repl = new BasicREPL(importObject);
      //clear editor
      var element = document.querySelector(".CodeMirror") as any;
      var editor = element.CodeMirror;
      editor.setValue("");
      editor.clearHistory();
    });

    document.getElementById("clear").addEventListener("click", function (e) {
      //clear repl output
      resetRepl();
    });

    document.getElementById("choose_file").addEventListener("change", function (e) {
      //clears repl output
      resetRepl();
      //resets environment
      repl = new BasicREPL(importObject);
      //load file
      var input: any = e.target;
      var reader = new FileReader();
      reader.onload = function () {
        filecontent = reader.result;
      };
      reader.readAsText(input.files[0]);
    });

    document.getElementById("load").addEventListener("click", function (e) {
      var element = document.querySelector(".CodeMirror") as any;
      var editor = element.CodeMirror;
      editor.setValue(filecontent);
    });

    document.getElementById("save").addEventListener("click", function (e) {
      //download the code in the editor
      var FileSaver = require("file-saver");
      var title = (document.getElementById("save_title") as any).value;
      var element = document.querySelector(".CodeMirror") as any;
      var editor = element.CodeMirror;
      var code = editor.getValue();
      var blob = new Blob([code], { type: "text/plain;charset=utf-8" });
      FileSaver.saveAs(blob, title);
    });
    document.getElementById("hiderepls").addEventListener("click", function (e) {
      var button = document.getElementById("hiderepls");
      var editor = document.getElementById("editor");
      var interactions = document.getElementById("interactions");
      if (button.innerText == "Hide REPLs"){
        if (window.innerWidth>=840) editor.style.width = "96%";
        interactions.style.display = "none";
        button.innerText = "Display REPLs";
        hiderepl = true;
      }
      else{
        if (window.innerWidth>=840) editor.style.width = "46%";
        interactions.style.display = "inline";
        button.innerText = "Hide REPLs";
        hiderepl = false;
      }
    });
    setupRepl();
  });
  window.addEventListener("resize", (event) => {
    var editor = document.getElementById("editor");
    var interactions = document.getElementById("interactions");
    if (window.innerWidth<840) {
      editor.style.width = "96%";
      interactions.style.width = "96%";
    }
    else{
      if (hiderepl==false){
        editor.style.width = "46%";
      }
      else{
        editor.style.width = "96%";
      }
      interactions.style.width = "46%";
    }
  })
  window.addEventListener("load", (event) => {
    var interactions = document.getElementById("interactions");
    if (window.innerHeight>900){
      interactions.style.height = "800px";
    }

    const themeList = themeList_export;
    const dropdown = document.getElementById("themes");
    for (const theme of themeList) {
      var option = document.createElement("option");
      option.value = theme;
      option.text = theme;
      dropdown.appendChild(option);
    }

    const textarea = document.getElementById("user-code") as HTMLTextAreaElement;
    const editor = CodeMirror.fromTextArea(textarea, {
      mode: "python",
      theme: "neo",
      lineNumbers: true,
      autoCloseBrackets: true,
      lint: true,
      gutters: ["error"],
      extraKeys: {
        "Ctrl+Space": "autocomplete",
      },
      hintOptions: {
        alignWithWord: false,
        completeSingle: false,
      },
      scrollbarStyle: "simple",
    });

    editor.on("change", (cm, change) => {
      textarea.value = editor.getValue();
    });
    editor.on("inputRead", function onChange(editor, input) {
      if (input.text[0] === ";" || input.text[0] === " " || input.text[0] === ":") {
        return;
      }
      editor.showHint({
        // hint:
      });
    });

    var themeDropDown = document.getElementById("themes") as HTMLSelectElement;
    themeDropDown.addEventListener("change", (event) => {
      var ele = document.querySelector(".CodeMirror") as any;
      var editor = ele.CodeMirror;
      editor.setOption("theme", themeDropDown.value);
    });



  });
}
// Simple helper to highlight line given line number
function highlightLine(actualLineNumber: number, msg: string): void {
  var ele = document.querySelector(".CodeMirror") as any;
  var editor = ele.CodeMirror;
  //Set line CSS class to the line number & affecting the background of the line with the css class of line-error
  editor.setGutterMarker(actualLineNumber, "error", makeMarker(msg));
  editor.addLineClass(actualLineNumber, "background", "line-error");
}
function makeMarker(msg: any): any {
  const marker = document.createElement("div");
  marker.classList.add("error-marker");
  marker.innerHTML = "&nbsp;";

  const error = document.createElement("div");
  error.innerHTML = msg;
  error.classList.add("error-message");
  marker.appendChild(error);

  return marker;
}

webStart();
