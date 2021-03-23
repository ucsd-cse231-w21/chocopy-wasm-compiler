import { PythonShell } from "python-shell";
import { Value } from "../ast";
import { appendFileSync } from "fs";

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

export function runPython(program: string): Value | Error {
  var outString;
  var isError = false;
  let pyshell = PythonShell.runString(program, null, function (err, msgs) {
    if (err) return { tag: "error" };
    if (msgs && msgs.length > 0) {
      outString = msgs[msgs.length - 1];
    } else {
      return { tag: "none" };
    }
    console.log("finished");

    return stringToAstValue(outString);
  });
  while (outString !== undefined); //busywait
  return { tag: "error" };
}

export function logFailure(
  program: string,
  compilerValue: Value | Error,
  correctValue: Value | Error
) {
  let logMsg = `\n--------------------\nFuzzer program failed\n Program source:${program}\nCompiler value: ${compilerValue}\nPython value: ${correctValue}`;
  appendFileSync("fuzzer/fuzzer_log.txt", logMsg);
}
