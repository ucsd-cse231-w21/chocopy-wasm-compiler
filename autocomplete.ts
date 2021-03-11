import CodeMirror from "codemirror";
import { BasicREPL } from "./repl";

export function populateAutoCompleteSrc(repl: BasicREPL) : Array<any> {
    var defList : string[] = [];
    var classMethodList : string[] = [];
    //get variable names for autocomplete
    repl.currentTypeEnv.globals.forEach((val, key) =>{
    //don't add functions into variable list
        if(val.tag != "callable"){
            defList.push(key);
        }
    })
    //get class names for autocomplete
    repl.currentTypeEnv.classes.forEach((val, key) =>{
        defList.push(key)
        //second element denotes class methods
        if(val.length > 1){
            val[1].forEach((v, k) =>{
                classMethodList.push(k+"()");
            })
        }
    })
    //get function names for autocomplete
    repl.currentTypeEnv.functions.forEach((val, key) =>{
        defList.push(key+"()");
    });
    return [defList, classMethodList];
}

export function autocompleteHint(editor : any, keywords : String[], getToken : any) {;
    // Find the token at the cursor
    var currPos = editor.getCursor();
    var token = getToken(editor, currPos), tprop = token;
    var isClassMethod = false;
    if(token.string[token.string.length-1] === "."){
        isClassMethod = true;
        token = tprop = {start: currPos.ch, end: currPos.ch, string: "", state: token.state,
                           type: "property"};
    }
    else if(token.type == "property"){
        isClassMethod = true;
    }
    //ignore any non word or property token
    else if (!/^[\w$_]*$/.test(token.string)) {
        token = tprop = {start: currPos.ch, end: currPos.ch, string: "", state: token.state, className: token.string == ":" ? "python-type" : null};
    }
  
    if (!context || isClassMethod) {
        var context = [];
        context.push(tprop);
  
        var completionList = getCompletions(keywords,token, context);
        completionList = completionList.sort();
        //show dropdown with one word (restrict automatic autocomplete of single word)
        if(completionList.length == 1) {
            completionList.push(" ");
        }
    }
    return {list: completionList, from: CodeMirror.Pos(currPos.line, token.start), to: CodeMirror.Pos(currPos.line, token.end)};
}
  
  
function getCompletions(wordList: any, token : any, context : any) {
    var completions :any[] = [];
    var prefix = token.string;
    function maybeAdd(str: string) {
        //only add word if not already in array and prefix matches word
        if (str.indexOf(prefix) == 0 && !strExists(completions, str)) {
            completions.push(str)
        }
    }
  
    if (context) {
        // If this is a property, see if it belongs to some object we can
        // find in the current environment.
        var obj = context.pop(), base;
  
        if (obj.type == "variable"){
            base = obj.string;
        }
        else if(obj.type == "variable-3"){
            base = ":" + obj.string;
        }
        else if(obj.type == "property"){
            base = obj.string;
        }
  
        while (base != null && context.length)
          base = base[context.pop().string];
        if (base != null) {
            completions = gatherCompletions(wordList, prefix);
        }
      }
      return completions;
}

function gatherCompletions(wordList: string[], prefix: string) : string[] {
    var completions : string[] = [];
    for(var i = 0; i < wordList.length; i++){
        var str = wordList[i];
        //only add word if not already in array and prefix matches word
        if(str.indexOf(prefix) == 0 && !strExists(completions, str)){
            completions.push(str);
        }
    }
    return completions;
}

function strExists(arr: string[], item : String){
    for(var i = 0; i < arr.length; i++){
        if(arr[i] == item){
            return true;
        }
    }
    return false;
}