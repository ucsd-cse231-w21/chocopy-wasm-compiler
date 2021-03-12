import { PythonShell } from "python-shell";
import { Value } from "../ast";

export type Error = { tag: "error" };

function stringToAstValue(input: string): Value {
  switch (input) {
    case "True":
    case "False":
      return { tag: "bool", value: input == "True" };
    case "None":
      return { tag: "none" };
    default:
      try {
        return { tag: "num", value: BigInt(input) };
      } catch (e) {
        throw new Error(
          `Failed to convert value ${input} to Value, likely because object Values aren't implemented yet`
        );
      }
  }
}

function runPython(program: string): Value | Error {
  var outString;
  var isError = false;
  let pyshell = PythonShell.runString(program, null, function (err, msgs) {
    console.log(">Program:\n" + program + "\n>End Program\n");
    if (err) isError = true;
    outString = msgs[msgs.length - 1];
    console.log("finished");
  });
  if (isError) {
    return { tag: "error" };
  }
  return stringToAstValue(outString);
}
