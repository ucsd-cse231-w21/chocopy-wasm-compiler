import { PyInt, PyBool, PyNone, PyObj } from '../utils';
import { assert, asserts, assertPrint } from "./utils.test";

describe('run', () => {
    // assert('Parsing Empty List', '[]',  PyNone())
    // assert('Parsing List', '[1,2,3]',  PyNone())
    var source = `
        items : [int] = None
        items = [1, 2, 3]
        items
    `
  
    assert('Parsing Empty List', source,  PyObj(`list<number>`, 8))
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