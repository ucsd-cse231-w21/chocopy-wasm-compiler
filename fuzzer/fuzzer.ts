import { genProgram } from "./gen";
import { PythonShell } from "python-shell";
let programLines = genProgram();
programLines[programLines.length - 1] =
  "print(" + programLines[programLines.length - 1] + ")";
var program = programLines.join("\n");

let pyshell = PythonShell.runString(program, null, function (err, msgs) {
  console.log(">Program:\n", program, "\n>End Program\n");
  if (err) console.log("ERROR:", err);
  console.log("stdout: ", msgs);
  console.log("finished");
});
