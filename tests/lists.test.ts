import { PyInt, PyBool, PyNone, PyObj, LIST, NONE, NUM } from "../utils";
import { assert, asserts, assertPrint, assertTC } from "./utils.test";

describe("LIST TEST", () => {
  //Programs described in the writeup, with additional changes
  //as necessary to actually test functionality

  var source = `
    x : [int] = None
    y : [int] = None
    x = [1,2,3]
    y = x.copy()
    print(y[0])
    print(y[1])
    print(y[2])
    x.clear()
    x.append(4)
    x[0]
  `;
  assertPrint("Program 1: List Functions (prints)", source, ["1", "2", "3"]);
  assert("Program 1: List Functions", source, PyInt(4));

  var source = `
    items : [int] = None
    items = [1, 2, 3, 4, 5, 6, 7, 8]
    print(items[0])
    print(items[3])
    print(items[4])
    print(items[6])
    items[7]
  `;
  assertPrint("Program 2: Assign List To Variable (prints)", source, ["1", "4", "5", "7"]);
  assert("Program 2: Assign List To Variable", source, PyInt(8));

  var source = `
    items : [int] = None
    items = [1, 2, 3] + [4, 5, 6]
    items[5]
  `;

  assert("Program 3: Concat Lists", source, PyInt(6));
  var source = `
    items : [int] = None
    n : int = 10
    items = [1, 2]
    n = items[0] + items[1]
    n
  `;

  assert("Program 4: Lists Access", source, PyInt(1 + 2));

  var source = `
    items : [int] = None
    items = [1, 2, 3] 
    print(items[1])
    items[1] = 90
    items[1]
  `;
  assertPrint("Program 5: List Assign (prints)", source, ["2"]);
  assert("Program 5: List Assign", source, PyInt(90));

  //Other Tests
  assertTC("List With Number", "[1,2,3]", LIST({ tag: "number" }));

  assert("Lists Declaration", "items : [int] = None\nitems", PyNone());

  var source = `
        class A(object):
            n:int = 100
        x : [A] = None
        x1 : A = None
        x2 : A = None
        x3 : A = None
        x = [A(),A(),A()]
        print(x[0].n)
        print(x[1].n)
        print(x[2].n)
        x[1].n = 12940
        x[1].n
        `;
  assertPrint("List with Class (prints)", source, ["100", "100", "100"]);
  assert("List With Class", source, PyInt(12940));

  var source = `
    items : [bool] = None
    stuff : [bool] = None
    concatted : [bool] = None
    items = [True, True, False]
    stuff = [False, True]
    concatted = items + stuff
    concatted[4]
  `;
  assert("Concat List Vars", source, PyBool(true));

  var source = `
    i : int = 1
    items : [int] = None
    items = [-54, 959, 888, 0]
    items[i+1]
  `;
  assert("List Access with Expr as Index", source, PyInt(888));

  var source = `
    i : int = 9
    a : [int] = None
    a = [1, 2, 3, 4, 5, 6, 7]
    print(a[i-(2*3)])
    a[i-(2*3)] = 60
    a[i-(2*3)]
  `;
  assertPrint("List Access & Assign with Expr as Index (prints)", source, ["4"]);
  assert("List Access & Assign with Expr as Index", source, PyInt(60));

  var source = `
    items : [int] = None
    items = [1,2,3]
    items.append(1)
    items[3]
  `;
  assert("List Append", source, PyInt(1));

  var source = `
    items : [int] = None
    items = [1,2,3]
    items.index(4)
  `;
  assert("List index miss", source, PyInt(-1));

  var source = `
    items : [int] = None
    items = [1,2,3]
    items.index(3)
  `;
  assert("List index found", source, PyInt(2));

  var source = `
    items : [int] = None
    stuff : [int] = None
    extra : [int] = None
    items = [589, 21312222, 40538]
    stuff = items.copy()
    print(items[0])
    print(stuff[0])
    items[0] = 6666
    print(items[0])
    stuff[0]
  `;
  assertPrint("Test .copy() (prints)", source, ["589", "589", "6666"]);
  assert("Test .copy()", source, PyInt(589));

  var source = `
    a : [int] = None
    i : int = 0
    a = [0, 0, 1, 2, 3, 3, 3, 3, 3, 4, 5, 5, 5, 7, 10]
    while i <= 10:
      print(a.count(i))
      i = i + 1
  `;
  assertPrint("Test .count() (prints)", source, [
    "2",
    "1",
    "1",
    "5",
    "1",
    "3",
    "0",
    "1",
    "0",
    "0",
    "1",
  ]);
  assert("Test .count()", source, PyNone());

  var source = `
    []
  `;
  assertTC("Empty list", source, LIST(null));
  var source = `
  a : [int] = None
  a = []
  a
  `;
  assertTC("Assign Empty list", source, LIST(NUM));

  var source = `
  a : [int] = None
  a = []
  a.append(1)
  a[0]
  `;
  assert("Empty list append", source, PyInt(1));

  var source = `
  [].append(1)[0]
  `;
  assert("Empty list append 2", source, PyInt(1));

  var source = `
  [].clear()
  `;
  assertTC("Empty list clear 2", source, LIST(null));

  var source = `
  a : [int] = None
  a = [] + []
  a
  `;
  assertTC("Assign Empty list", source, LIST(NUM));

  var source = `
  a : [int] = None
  a = [] + [1,2,3]
  a[1]
  `;
  assert("Empty list append 2", source, PyInt(2));
  var source = `
  a : [int] = None
  a = [] + [1,2,3]
  len(a)
  `;
  assert("List len ", source, PyInt(3));

  var source = `
  a : [int] = None
  a = []
  len(a)
  `;
  assert("List len 0", source, PyInt(0));
});
