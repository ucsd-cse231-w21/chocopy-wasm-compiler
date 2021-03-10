// -*- mode: typescript; typescript-indent-level: 2; -*-

import { PyInt, PyBool, PyNone, PyStr, NUM, CLASS } from "../utils";
import { assert, asserts, assertPrint, assertTCFail, assertTC, assertFail } from "./utils.test";

const initStrs = `t0: str = "Hello!"\nt1: str = "World"\nnumbers: str = "1 2 3 4 5 6 7 8"`;

describe("String slicing tests", () => {
  const ironPythonTestStr = `x:str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"`;
  assert("iron-python-test-suite-0", `${ironPythonTestStr}\nx[10] == "k"`, PyBool(true));
  assert("iron-python-test-suite-1", `${ironPythonTestStr}\nx[20] == "u"`, PyBool(true));
  assert("iron-python-test-suite-2", `${ironPythonTestStr}\nx[30] == "E"`, PyBool(true));
  assert("iron-python-test-suite-3", `${ironPythonTestStr}\nx[-10] == "Q"`, PyBool(true));
  assert("iron-python-test-suite-4", `${ironPythonTestStr}\nx[-3] == "X"`, PyBool(true));
  assert("iron-python-test-suite-5", `${ironPythonTestStr}\nx[14:20] == "opqrst"`, PyBool(true));
  assert("iron-python-test-suite-6", `${ironPythonTestStr}\nx[20:14] == ""`, PyBool(true));
  assert("iron-python-test-suite-7", `${ironPythonTestStr}\nx[-30:-5] == "wxyzABCDEFGHIJKLMNOPQRSTU"`, PyBool(true));
  assert("iron-python-test-suite-8", `${ironPythonTestStr}\nx[-5:-30] == ""`, PyBool(true));
  assert("iron-python-test-suite-9", `${ironPythonTestStr}\nx[3:40:2] == "dfhjlnprtvxzBDFHJLN"`, PyBool(true));
  assert("iron-python-test-suite-10", `${ironPythonTestStr}\nx[40:3:2] == ""`, PyBool(true));
  assert("iron-python-test-suite-11", `${ironPythonTestStr}\nx[3:40:-2] == ""`, PyBool(true));
  assert("iron-python-test-suite-12", `${ironPythonTestStr}\nx[40:3:-2] == "OMKIGECAywusqomkige"`, PyBool(true));
  assert("iron-python-test-suite-13", `${ironPythonTestStr}\nx[-40:-4:-2] == ""`, PyBool(true));
  assert("iron-python-test-suite-14", `${ironPythonTestStr}\nx[-4:-40:-2] == "WUSQOMKIGECAywusqo"`, PyBool(true));
  assert("iron-python-test-suite-15", `${ironPythonTestStr}\nx[-40:-4:2] == "moqsuwyACEGIKMOQSU"`, PyBool(true));
  assert("iron-python-test-suite-16", `${ironPythonTestStr}\nx[-4:-40:2] == ""`, PyBool(true));
  assert("iron-python-test-suite-17", `${ironPythonTestStr}\nx[-40:-5:-2] == ""`, PyBool(true));
  assert("iron-python-test-suite-18", `${ironPythonTestStr}\nx[-5:-40:-2] == "VTRPNLJHFDBzxvtrpn"`, PyBool(true));
  assert("iron-python-test-suite-19", `${ironPythonTestStr}\nx[-40:-5:2] == "moqsuwyACEGIKMOQSU"`, PyBool(true));
  assert("iron-python-test-suite-20", `${ironPythonTestStr}\nx[-5:-40:2] == ""`, PyBool(true));
  assert("iron-python-test-suite-21", `${ironPythonTestStr}\nx[-40:-6:-2] == ""`, PyBool(true));
  assert("iron-python-test-suite-22", `${ironPythonTestStr}\nx[-6:-40:-2] == "USQOMKIGECAywusqo"`, PyBool(true));
  assert("iron-python-test-suite-23", `${ironPythonTestStr}\nx[-40:-6:2] == "moqsuwyACEGIKMOQS"`, PyBool(true));
  assert("iron-python-test-suite-24", `${ironPythonTestStr}\nx[-6:-40:2] == ""`, PyBool(true));
  assert("iron-python-test-suite-25", `${ironPythonTestStr}\nx[-49:-5:-3] == ""`, PyBool(true));
  assert("iron-python-test-suite-26", `${ironPythonTestStr}\nx[-5:-49:-3] == "VSPMJGDAxurolif"`, PyBool(true));
  assert("iron-python-test-suite-27", `${ironPythonTestStr}\nx[-49:-5:3] == "dgjmpsvyBEHKNQT"`, PyBool(true));
  assert("iron-python-test-suite-28", `${ironPythonTestStr}\nx[-5:-49:3] == ""`, PyBool(true));
  assert("iron-python-test-suite-29", `${ironPythonTestStr}\nx[-50:-5:-3] == ""`, PyBool(true));
  assert("iron-python-test-suite-30", `${ironPythonTestStr}\nx[-5:-50:-3] == "VSPMJGDAxurolif"`, PyBool(true));
  assert("iron-python-test-suite-31", `${ironPythonTestStr}\nx[-50:-5:3] == "cfiloruxADGJMPS"`, PyBool(true));
  assert("iron-python-test-suite-32", `${ironPythonTestStr}\nx[-5:-50:3] == ""`, PyBool(true));
  assert("iron-python-test-suite-33", `${ironPythonTestStr}\nx[-51:-5:-3] == ""`, PyBool(true));
  assert("iron-python-test-suite-34", `${ironPythonTestStr}\nx[-5:-51:-3] == "VSPMJGDAxurolifc"`, PyBool(true));
  assert("iron-python-test-suite-35", `${ironPythonTestStr}\nx[-51:-5:3] == "behknqtwzCFILORU"`, PyBool(true));
  assert("iron-python-test-suite-36", `${ironPythonTestStr}\nx[-5:-51:3] == ""`, PyBool(true));

  assertPrint("slice-single-literal", `${initStrs}\nprint("ABCDEF"[3])`, [`D`]);
  assertPrint("slice-single-var", `${initStrs}\nprint(t0[3])`, [`l`]);
  assertPrint("slice-range-literal", `${initStrs}\nprint("ABCDEF"[0:3])`, [`ABC`]);
  assertPrint("slice-range-var", `${initStrs}\nt2: str = t0 + " " + t1\nprint(t2[3:5])`, [`lo`]);

  assertPrint("slice-range-step", `nums: str = "1 2 3 4 5 6"\nprint(nums[0:len(nums):2])`, [`123456`]);
  assertPrint("slice-range-step-neg", `nums: str = "123456"\nprint(nums[-1:0:-1])`, [`65432`]);

  assertPrint("slice-single-neg-0", `${initStrs}\nprint(numbers[-1])`, [`8`]);
  assertPrint("slice-single-neg-1", `${initStrs}\nprint(numbers[-2])`, [` `]);
  assertPrint("slice-single-neg-2", `${initStrs}\nprint(numbers[-3])`, [`7`]);

  assertPrint("slice-range-neg-0", `${initStrs}\nprint(numbers[0:-5])`, [`1 2 3 4 5 `]);
  assertPrint("slice-range-neg-1", `${initStrs}\nprint(numbers[-4:-1])`, [` 7 `]);
  assertPrint("slice-range-neg-2", `${initStrs}\nprint(numbers[-4:-3])`, [` `]);
  assertPrint("slice-range-neg-3", `${initStrs}\nprint(numbers[-4:-4])`, [``]);
  
  assertPrint("slice-range-rev-neg-0", `${initStrs}\nprint(numbers[-5:0])`, [``]);
  assertPrint("slice-range-rev-neg-1", `${initStrs}\nprint(numbers[-1:-4])`, [``]);
  assertPrint("slice-range-rev-neg-2", `${initStrs}\nprint(numbers[-3:-4])`, [``]);
  assertPrint("slice-range-rev-neg-3", `${initStrs}\nprint(numbers[-4:-4])`, [``]);  
});
