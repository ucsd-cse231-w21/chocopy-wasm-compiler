import { PyInt, PyBool, PyNone, PyList, NUM, CLASS, LIST, importDel } from "../utils";
import { assert, asserts, assertPrint, assertTCFail, assertTC, assertFail } from "./utils.test";
import { ndarrayName } from "../numpy"; 
import * as compiler from "../compiler";

describe("numpy tests", () => {
  beforeEach(function () {
    // reset tsHeap as each test is wrapped in REPL
    compiler.tsHeap.length = 0;
  })
  assertTC("1.1. import-numpy-tc", 
         `
         import numpy as np
         np`, 
         CLASS("numpy"));
  assert("1.2. import-numpy-tc", 
         `
         import numpy as np
         np`, 
         PyNone()); // offset value in WASM heap; has no field so it's 0
  assertTC("2.1. numpy-1darray-tc",          
         `
         import numpy as np
         a : np.ndarray = None
         a = np.array([1,2])
         a`, 
         CLASS(ndarrayName));
  assert("2.2. numpy-1darray-offset",          
         `
         import numpy as np
         a : np.ndarray = None
         a = np.array([1,2])
         a.data`, 
         PyList(0)); // offset of list in TS heap, not WASM heap
  assertPrint("2.3. numpy-1darray-content",          
         `
         import numpy as np
         a : np.ndarray = None
         a = np.array([1,2])
         print(a.flatten().tolist())`, // equivalent to: for e in a.flatten().tolist().tolist(): print(e)
         ["1", "2"]); // list content; flattened for easy test
  assertTC("3.1. numpy-2darray-tc",          
         `
         import numpy as np
         a : np.ndarray = None
         a = np.array([[1,2,3], [4,5,6]])
         a`, 
         CLASS(ndarrayName));
  assert("3.2. numpy-2darray-offset",          
         `
         import numpy as np
         a : np.ndarray = None
         a = np.array([[1,2,3], [4,5,6]])
         a.data`, 
         PyList(0)); 
  assertPrint("3.3. numpy-2darray-content",          
         `
         import numpy as np
         a : np.ndarray = None
         a = np.array([[1,2,3], [4,5,6]])
         print(a.flatten().tolist())`, 
         ["1", "2", "3", "4", "5", "6"]); 
  assertPrint("4. numpy-2darray-signed-content",          
         `
         import numpy as np
         b : np.ndarray = None
         b = np.array([[-1,2,-3], [-4,5,-6]])
         print(b.flatten().tolist())`, 
         ["-1", "2", "-3", "-4", "5", "-6"]); 
  asserts("5. numpy-2darray-shape", [
          [`import numpy as np
         a : np.ndarray = None
         a = np.array([[1,2,3], [4,5,6]])
         a.shape0`,  PyInt(2)],
         [`a.shape1`, PyInt(3)]
          ]); 
  assertTC("6.1. numpy-2darray-add-tc",          
         `
         import numpy as np
         a : np.ndarray = None
         b : np.ndarray = None
         a = np.array([[1,2,3], [4,5,6]])
         b = np.array([[-1,2,-3], [-4,5,-6]])
         a+b`, 
         CLASS(ndarrayName)); 
  assertPrint("6.2. numpy-2darray-add-content",          
         `
         import numpy as np
         a : np.ndarray = None
         b : np.ndarray = None
         a = np.array([[1,2,3], [4,5,6]])
         b = np.array([[-1,2,-3], [-4,5,-6]])
         print((a+b).flatten().tolist())`, 
         ["0", "4", "0", "0", "10", "0"]); 
  assertFail("7. numpy-2darray-add-fail",          
         `
         import numpy as np
         b : np.ndarray = None
         c : np.ndarray = None
         b = np.array([[-1,2,-3], [-4,5,-6]])
         c = np.array([[1,2], [4,5]])
         b+c`); 
  assertTC("8.1. numpy-2darray-dot-tc",          
         `
         import numpy as np
         b : np.ndarray = None
         c : np.ndarray = None
         b = np.array([[-1,2,-3], [-4,5,-6]])
         c = np.array([[1,2], [4,5]])
         c@b`, 
         CLASS(ndarrayName)); 
  assertPrint("8.2. numpy-2darray-dot-content",          
         `
         import numpy as np
         b : np.ndarray = None
         c : np.ndarray = None
         b = np.array([[-1,2,-3], [-4,5,-6]])
         c = np.array([[1,2], [4,5]])
         print((c@b).flatten().tolist())`, 
         ["-9", "12", "-15", "-24", "33", "-42"]); 
  assertFail("9. numpy-2darray-dot-fail",          
         `
         import numpy as np
         c : np.ndarray = None
         d : np.ndarray = None
         c = np.array([[1,2], [4,5]])
         d = np.array([[-1,2,-3], [-4,5,-6], [7,8,9]])
         c@d`); 
  asserts("10. numpy-2darray-more-data",          
       [[`
       import numpy as np
       c : np.ndarray = None
       d : np.ndarray = None
       c = np.array([[1,2], [4,5]])
       d = np.array([[-1,2,-3], [-4,5,-6], [7,8,9]])
       c.data`, PyList(0)], 
       [`d.data`, PyList(1)]]); 
  assertPrint("11. numpy-2darray-divide-content",          
         `
         import numpy as np
         a : np.ndarray = None
         b : np.ndarray = None
         a = np.array([[1,2,3], [4,5,6]])
         b = np.array([[-1,2,-3], [-4,5,-6]])
         print((a//b).flatten().tolist())`, 
         ["-1", "1", "-1", "-1", "1", "-1"]); 
  assertPrint("12. numpy-2darray-mul-content",          
         `
         import numpy as np
         a : np.ndarray = None
         b : np.ndarray = None
         a = np.array([[1,2,3], [4,5,6]])
         b = np.array([[-1,2,-3], [-4,5,-6]])
         print((a*b).flatten().tolist())`, 
         ["-1", "4", "-9", "-16", "25", "-36"]); 
  assertPrint("12. numpy-2darray-sub-content",          
         `
         import numpy as np
         a : np.ndarray = None
         b : np.ndarray = None
         a = np.array([[1,2,3], [4,5,6]])
         b = np.array([[-1,2,-3], [-4,5,-6]])
         print((a-b).flatten().tolist())`, 
         ["2", "0", "6", "8", "0", "12"]); 
  assertPrint("13. numpy-2darray-pow-content",          
         `
         import numpy as np
         a : np.ndarray = None
         b : np.ndarray = None
         a = np.array([[1,2,3], [4,5,6]])
         b = np.array([[-1,2,-3], [-4,5,-6]])
         print((b**a).flatten().tolist())`, 
         ["-1", "4", "-27", "256", "3125", "46656"]); 
});