import { PyInt, PyBool, PyNone, PyObj } from "../utils";
import { assert, asserts, assertPrint } from "./utils.test";

describe("LIST TEST", () => {


    var source = `
        items : [int] = None
        items = [1, 2, 3]
    `;


    assert("Assign List To Variable (Program 2)", source, PyNone());


    var source = `
    items : [int] = None
    items = [1, 2, 3] + [4, 5, 6]
    items[5]
    `;

    assert("Concat List (Program 3)", source, PyInt(6));



    var source = `
        items : [int] = None
        n : int = 10
        items = [1, 2]
        n = items[0] + items[1]
        n
    `;

    assert("Lists Access (Program 4)", source, PyInt(1 + 2));


    //Other Test
    assert("Empty List", "[]", PyObj(`list<none>`, 4));
    assert("List With Number", "[1,2,3]", PyObj(`list<number>`, 96));
    
        
    assert("Lists Declaration", "items : [int] = None\nitems", PyNone());




    var source = `
        class A(object):
            n:int = 100
        x : [A] = None
        x1 : A = None
        x2 : A = None
        x3 : A = None  
        x = [A(),A(),A()]
        `;

    assert("List With Class", source, PyNone());

  
});
