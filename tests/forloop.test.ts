import { PyInt, PyBool, PyNone, PyObj, LIST } from "../utils";
import { assert, asserts, assertPrint, assertTC, assertTCFail } from "./utils.test";

describe("FOR LOOP TEST", () => {
  //Programs described in the writeup, with additional changes
  //as necessary to actually test functionality
  assert(
    "for range(5)",
    `
    i:int = 0
    for i in range(5):
        print(i)
    i
    `,
    PyInt(4)
  );

  assert(
    "for range(0, 10)",
    `
    i:int = 0
    for i in range(10):
        print(i)
    i
    `,
    PyInt(9)
  );

  assert(
    "for range(1, 10, 1)",
    `
    i:int = 0
    x:int = 0
    for i in range(1, 10, 1):
      x = x + 1
    x
    `,
    PyInt(9)
  );
  
  assert(
    "for range(1, 10, 2)",
    `
    i:int = 0
    x:int = 0
    for i in range(1, 10, 2):
      x = x + 1
    x
    `,
    PyInt(5)
  );

  assertTCFail(
    "break outside loop",
    `
    i:int = 0
    break
    for i in range(5):
        print(i)
    `
  );

  assertTCFail(
    "continue outside loop",
    `
    i:int = 0
    continue
    for i in range(5):
        print(i)
    `
  );

  assert(
    "break at 5",
    `
    i:int = 0
    for i in range(10):
        print(i)
        if i == 5:
            break
        else:
            pass
    i
    `,
    PyInt(5)
  );

  assert(
    "continue at 5",
    `
    i:int = 0
    x:int = 0
    for i in range(6):
        if i == 5:
            continue
            i = 5
        else:
            pass
    x
    `,
    PyInt(0)
  );

  assertPrint(
    "Multiple for loops with print",
    `
    i:int = 3
    j:int = 5
    for i in range(5):
      print(i)
    for j in range(1, 3, 1):
      print(j)
    `,
    ["0", "1", "2", "3", "4", "1", "2"]
  );

  assert(
    "double nested for loop",
    `
    i:int = 0
    x:int = 0
    z:int = 0
      
    for i in range(10):
      for x in range(5):
        z = z + 1
    z
    `,
    PyInt(50)
  );

  assertPrint(
    "triple nested for loop",
    `
    i:int = 0
    j:int = 0
    k:int = 0
      
    for i in range(1, 3):
      for j in range(1, 3):
        for k in range(1, 3):
          print(i*j*k)
    `,
    ['1', '2', '2', '4', '2', '4', '4', '8']
  );

  assertPrint(
    "break in nested for loop",
    `
    i:int = 0
    j:int = 0
    k:int = 0
      
    for i in range(1, 3):
      for j in range(1, 3):
        for k in range(1, 3):
          if k > 1:
            break
          else:
            pass
          print(i*j*k)
    `,
    ['1', '2', '2', '4']
  );

  assertPrint(
    "continue in nested for loop",
    `
    i:int = 0
    j:int = 0
    k:int = 0
      
    for i in range(1, 3):
      for j in range(1, 3):
        for k in range(1, 3):
          if k == 1:
            continue
          else:
            pass
          print(i*j*k)
    `,
    ['2', '4', '4', '8']
  );

  assertPrint(
    "loop in function",
    `
    k:int = 5
  
    def count(x:int):
      i:int = 0
      for i in range(x):
        print(i)
      
    count(k)
    `,
    ['0', '1', '2', '3', '4']
  );


  assertPrint(
    "loop in class",
    `
    class Counter(object):
      x:int = 0
  
      def print_loop(self: Counter, x:int):
        i:int = 0
          
        for i in range(x):
          print(i)
        
        
    Counter().print_loop(5)
    `,
    ['0', '1', '2', '3', '4']
  );

});
