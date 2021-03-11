import { BasicREPL } from "./repl";
import { Type, Value } from "./ast";
import { NUM, BOOL, NONE, STRING, PyValue, unhandledTag } from "./utils";

export function addAccordionEvent() {
  var acc = document.getElementsByClassName("accordion");
  var i = 0;
  for (i; i < acc.length; i++) {
    if (acc[i].getAttribute("listener") !== "true") {
      acc[i].setAttribute("listener", "true");
      acc[i].addEventListener("click", function () {
        this.classList.toggle("active");
        var panel = this.nextElementSibling;
        var arrow = this.firstChild;
        if (panel.style.display === "block") {
          panel.style.display = "none";
          arrow.style.transform = "rotate(-45deg)";
        } else {
          panel.style.display = "block";
          arrow.style.transform = "rotate(45deg)";
        }
      });
    }
  }
}

export function prettyPrintObjects(result: Value, repl: BasicREPL, currentEle: any) {
  switch (result.tag) {
    case "object":
      prettyPrintClassObject(result, repl, currentEle);
      break;
    case "list":
      prettyPrintList(result, repl, currentEle);
      break;
    case "dict":
      prettyPrintDictionary(result, repl, currentEle);
      break;
  }
}

function prettyPrintDictionary(result: any, repl: BasicREPL, currentEle: any) {
  const view = new Int32Array(repl.importObject.js.memory.buffer);
  const hashtableSize = 10;
  const exp = document.createElement("button") as HTMLButtonElement;
  exp.innerHTML = "<i class='arrow' id='arrow'></i> " + result.tag + `&lt${result.tag}&gt`;
  exp.setAttribute("class", "accordion");
  const div = document.createElement("div");
  div.setAttribute("class", "panel");
  const addr = document.createElement("p");
  addr.innerHTML = "<b class='tag'>address: </b><p class='val'>" + result.address + "</p>";
  div.appendChild(addr);

  var i = 0;
  for (i = 0; i < hashtableSize; i++) {
    const hash_entry = view[result.address / 4 + i];
    if (hash_entry != 0) {
      printDictionaryLLHelper(result, hash_entry / 4, repl, view, div);
    }
  }
  currentEle.appendChild(exp);
  currentEle.appendChild(div);
}

function printDictionaryLLHelper(
  result: any,
  baseIndex: number,
  repl: BasicREPL,
  view: any,
  currentEle: any
) {
  const key = view[baseIndex + 0];
  const value = view[baseIndex + 1];
  const next_ptr = view[baseIndex + 2];

  const ele = document.createElement("pre");
  var ele_key = PyValue(result.key_type, key, view) as any;

  switch (result.value_type.tag) {
    case "dict":
      const val = PyValue(result.value_type, value, view);
      if (val.tag !== "none") {
        ele.innerHTML = "<b class='tag'>" + ele_key.value + ":</b>";
        const new_div = document.createElement("div");
        ele.appendChild(new_div);
        prettyPrintDictionary(val, repl, new_div);
      }
      break;
    // case "class":
    //   prettyPrintClassObject(result, repl, currentEle);
    // case "list":
    //   break;
    default:
      var ele_val = PyValue(result.value_type, value, view) as any;
      ele.innerHTML =
        "<b class='tag'>" + ele_key.value + ": </b><p class='val'>" + ele_val.value + "</p>";
  }

  currentEle.appendChild(ele);

  console.log(key, value);
  if (next_ptr != 0) {
    printDictionaryLLHelper(result, next_ptr / 4, repl, view, currentEle);
  }
}

function prettyPrintClassObject(result: any, repl: BasicREPL, currentEle: any) {
  const view = new Int32Array(repl.importObject.js.memory.buffer);
  const typedCls = repl.currentTypeEnv.classes.get(result.name)[0];
  const cls = repl.currentEnv.classes.get(result.name);

  const exp = document.createElement("button") as HTMLButtonElement;
  exp.setAttribute("class", "accordion");
  const div = document.createElement("div");
  div.setAttribute("class", "panel");
  const addr = document.createElement("p");
  addr.innerHTML = "<b class='tag'>address: </b><p class='val'>" + result.address + "</p>";

  exp.innerHTML = "<i class='arrow' id='arrow'></i> " + result.name + " object";
  div.appendChild(addr);

  cls.forEach((value, key) => {
    var offset = value[0];
    var type = typedCls.get(key);

    const ele = document.createElement("pre");
    const val = PyValue(type, view[result.address / 4 + offset], view) as any;
    // PyValue implementation seems incomplete, casting to any for now

    // pretty printing object fields
    switch (type.tag) {
      case "class":
        if (val.tag !== "none") {
          ele.innerHTML = "<b class='tag'>" + key + ":</b>";
          const new_div = document.createElement("div");
          ele.appendChild(new_div);
          prettyPrintClassObject(
            {
              tag: "object",
              name: type.name,
              address: view[result.address / 4 + offset],
            },
            repl,
            new_div
          );
        } else {
          ele.innerHTML = "<b class='tag'>" + key + ": </b> <p class='val'>none</p>";
        }
        break;
      case "list":
        if (val.tag !== "none") {
          ele.innerHTML = "<b class='tag'>" + key + ":</b>";
          const new_div = document.createElement("div");
          ele.appendChild(new_div);
          prettyPrintList(
            {
              tag: "list",
              name: "list",
              address: view[result.address / 4 + offset],
              content_type: type.content_type,
            },
            repl,
            new_div
          );
        } else {
          ele.innerHTML = "<b class='tag'>" + key + ": </b> <p class='val'>none</p>";
        }
        break;
      case "dict":
        if (val.tag !== "none") {
          ele.innerHTML = "<b class='tag'>" + key + ":</b>";
          const new_div = document.createElement("div");
          ele.appendChild(new_div);
          prettyPrintDictionary(
            {
              tag: "dict",
              key_type: type.key,
              value_type: type.value,
              address: view[result.address / 4 + offset],
            },
            repl,
            new_div
          );
        } else {
          ele.innerHTML = "<b class='tag'>" + key + ": </b> <p class='val'>none</p>";
        }
        break;
      default:
        ele.innerHTML = "<b class='tag'>" + key + ": </b><p class='val'>" + val.value + "</p>";
        break;
    }
    div.appendChild(ele);
  });

  currentEle.appendChild(exp);
  currentEle.appendChild(div);
}

function prettyPrintList(result: any, repl: BasicREPL, currentEle: any) {
  const view = new Int32Array(repl.importObject.js.memory.buffer);
  var type = result.content_type;
  var size = view[result.address / 4 + 1];
  var bound = view[result.address / 4 + 2];

  console.log(type, size, bound);

  const exp = document.createElement("button") as HTMLButtonElement;
  exp.innerHTML =
    "<i class='arrow' id='arrow'></i> " + result.tag + `&lt${result.content_type.tag}&gt`;
  exp.setAttribute("class", "accordion");
  const div = document.createElement("div");
  div.setAttribute("class", "panel");
  const addr = document.createElement("p");
  addr.innerHTML = "<b class='tag'>address: </b><p class='val'>" + result.address + "</p>";
  div.appendChild(addr);

  var i = 0;
  for (i = 0; i < size; i++) {
    const ele = document.createElement("pre");
    switch (type.tag) {
      case "class":
        const val = PyValue(type, view[result.address / 4 + 3 + i], view);
        if (val.tag !== "none") {
          ele.innerHTML = "<b class='tag'>" + i + ":</b>";
          var class_name = type.name;
          const new_div = document.createElement("div");
          ele.appendChild(new_div);
          prettyPrintClassObject(
            {
              tag: "object",
              name: class_name,
              address: view[result.address / 4 + 3 + i],
            },
            repl,
            new_div
          );
        } else {
          ele.innerHTML = "<b class='tag'>" + i + ": </b> <p class='val'>none</p>";
        }
        break;
      // case "dict":

      //   break;
      default:
        var ele_val = PyValue(type, view[result.address / 4 + 3 + i], view) as any;
        ele.innerHTML = "<b class='tag'>" + i + ": </b><p class='val'>" + ele_val.value + "</p>";
        break;
    }
    div.appendChild(ele);
  }
  currentEle.appendChild(exp);
  currentEle.appendChild(div);
}
