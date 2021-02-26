import { BasicREPL } from './repl';

document.addEventListener("DOMContentLoaded", function () {

  function print(type: number, value: any) {
    console.log("Logging from WASM: ", type, ", ", value);
    const elt = document.createElement("pre");
    document.getElementById("output").appendChild(elt);
    let text = "";
    if (type === 1) {
      if (value === 0) {
        text = "False";
      } else {
        text = "True";
      }
    } else if (type === 2) {
      text = value.toString();
    } else if (type === 3) {
      text = value;
    } else {
      if (value === 0) {
        text = "None";
      } else {
        text = value.toString();
      }
    }
    elt.innerText = text;
    return value;
  }

  let importObject = {
    builtin: {
      print,
    }
  }
  
  var repl = new BasicREPL(importObject);

  function renderResult(result: any): void {
    if (result === undefined) { console.log("skip"); return; }
    const elt = document.createElement("pre");
    document.getElementById("output").appendChild(elt);
    elt.innerText = String(result);
  }

  function renderError(result: any): void {
    const elt = document.createElement("pre");
    document.getElementById("output").appendChild(elt);
    elt.setAttribute("style", "color: red");
    elt.innerText = String(result);
  }

  function setupRepl() {
    const replCodeElement = document.getElementById("next-code") as HTMLInputElement;
    replCodeElement.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        // capture the old entry
        const output = document.createElement("div");

        const prompt = document.createElement("span");
        prompt.innerText = "»";

        const elt = document.createElement("input");
        elt.type = "text";
        elt.disabled = true;
        elt.className = "repl-code";

        output.appendChild(prompt);
        output.appendChild(elt);
        document.getElementById("output").appendChild(output);

        const source = replCodeElement.value;
        elt.value = source;

        // clear the entry
        replCodeElement.value = "";

        // print output
        repl.run(source).then((r) => {
          renderResult(r);
          console.log("run finished")
        }).catch((e) => {
          renderError(e);
          console.log("run failed", e);
        });
      }
    });
  }

  document.getElementById("run").addEventListener("click", function (e) {
    // clear last results
    document.getElementById("output").innerHTML = "";

    repl = new BasicREPL(importObject);
    const source = (document.getElementById("user-code") as HTMLTextAreaElement).value;
    setupRepl();
    repl.run(source).then((r) => {
      renderResult(r);
      console.log("run finished");
    }).catch((e) => {
      renderError(e);
      console.log("run failed", e)
    });
  });
});

