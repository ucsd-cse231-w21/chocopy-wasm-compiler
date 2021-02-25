window.addEventListener('load', (event) => {
    var editor = CodeMirror.fromTextArea(document.getElementById("user-code"), {
        mode: "python",
        theme: "neo",
        lineNumbers: true,
        autoCloseBrackets: true,
    });
    editor.on("change", (cm, change)=>{
        document.getElementById("user-code").value = editor.getValue();
    })
});