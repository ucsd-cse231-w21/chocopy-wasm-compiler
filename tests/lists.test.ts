import { PyInt, PyBool, PyNone, PyObj } from "../utils";
import { assert, asserts, assertPrint } from "./utils.test";

describe('LIST TEST', () => {
    assert('Empty List', '[]',  PyObj(`list<none>`, 4))
    assert('List With Number', '[1,2,3]',  PyObj(`list<number>`, 96))
    var source = `
        items : [int] = None
        items = [1, 2, 3]
    `
    assert('Lists Declaration','items : [int] = None\nitems', PyNone())
    assert('Assign List To Variable', source, PyNone())    
  
    var source = `
        items : [int] = None
        items = [1, 2, 3] + [2, 3, 4]
        items[5]
    `

    assert('Concat List', source,  PyInt(4))    
  

    var source = `
    class A(object):
        n:int = 100
    x : [A] = None
    x1 : A = None
    x2 : A = None
    x3 : A = None  
    x = [A(),A(),A()]
    `

    assert('List With Class', source,  PyNone())
    
    var source = `
        items : [int] = None
        n : int = 10
        items = [1, 2]
        n = items[0] + items[1]
        n
    `
    assert('Lists Access', source,  PyInt(1 + 2))


 
  });