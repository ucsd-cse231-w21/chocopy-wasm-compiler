import { PyInt, PyBool, PyNone, PyObj } from '../utils';
import { assert, asserts, assertPrint } from "./utils.test";

describe('run', () => {
    // assert('Parsing Empty List', '[]',  PyNone())
    // assert('Parsing List', '[1,2,3]',  PyNone())
//     var source = `
//         items : [int] = None
//         items = [1, 2, 3]
//         items
//     `
  
//     assert('Parsing Empty List', source,  PyObj(`list<number>`, 8))

//     var source = `
//         items : [int] = None
//         items = [1, 2, 3] + [2, 3, 4]
//         items
//     `
  
//     assert('Parsing Empty List', source,  PyObj(`list<number>`, 8))
//     var source = `
//     items : int = 1
//     while(False):
//         items = 3
//     items
// `
    var source = `
    class A(object):
        n:int = 100
    x : [A] = None
    x1 : A = None
    x2 : A = None
    x3 : A = None  
    x1 = A()
    x2 = A()
    x3 = A()
    x = [x1,x2,x3]
    `

    var source = `
    class A(object):
        n:int = 100
    x : [A] = None
    x1 : A = None
    x2 : A = None
    x3 : A = None  
    x = [A(),A(),A()]
    `

    var source = `
    x : [int] = None
    x = [1,2,3] + [1,2,3]
    `
  
    assert('Parsing Empty List', source,  PyNone())
//     assert('Parsing Empty List', source,  PyInt(1))
    // assert('Lists Declaration','items : [int] = None\nitems', PyNone())
    // var source = `
    //     items : [int] = None
    //     n : int = 10
    //     items = [1, 2]
    //     n = items[0] + items[1]
    //     n
    // `
    // assert('Lists Access', source,  PyInt(1 + 2))


 
  });