import { PyInt, PyBool, PyNone, NUM, CLASS } from "../utils";
import { assert, asserts, assertPrint, assertTCFail, assertTC, assertFail } from "./utils.test";

describe("numpy tests", () => {
  // 1
  assertTC("import-numpy-tc", 
         `
         import numpy as np
         np`, 
         CLASS("numpy$import"));
  // 2.1
  assertTC("numpy-array-tc",          
         `
         import numpy as np
         a : np = None
         a = np.array(10)
         a`, 
         CLASS("numpy"));
  // 2.2
  // assert("numpy-array-offset",          
  //        `
  //        import numpy as np
  //        a : np = None
  //        a = np.array(10)
  //        a`, 
  //        PyInt(999)); // TODO: test real offset after updating numpyArray() in numpy.ts; import module in runner.ts
});
