"use strict";
exports.__esModule = true;
exports.LIST = exports.CLASS = exports.NONE = exports.BOOL = exports.NUM = exports.isTagged = exports.PyNone = exports.PyObj = exports.PyBool = exports.PyInt = exports.PyValue = void 0;
function PyValue(typ, result) {
    switch (typ.tag) {
        case "number":
            return PyInt(result);
        case "bool":
            return PyBool(Boolean(result));
        case "class":
            return PyObj(typ.name, result);
        case "none":
            return PyNone();
        case "list":
            return PyObj(typ.tag + ("<" + typ.content_type.tag + ">"), result);
    }
}
exports.PyValue = PyValue;
function PyInt(n) {
    return { tag: "num", value: BigInt(n) };
}
exports.PyInt = PyInt;
function PyBool(b) {
    return { tag: "bool", value: b };
}
exports.PyBool = PyBool;
function PyObj(name, address) {
    if (address === 0)
        return PyNone();
    else
        return { tag: "object", name: name, address: address };
}
exports.PyObj = PyObj;
function PyNone() {
    return { tag: "none" };
}
exports.PyNone = PyNone;
function isTagged(val, set) {
    return set.includes(val.tag);
}
exports.isTagged = isTagged;
exports.NUM = { tag: "number" };
exports.BOOL = { tag: "bool" };
exports.NONE = { tag: "none" };
function CLASS(name) { return { tag: "class", name: name }; }
exports.CLASS = CLASS;
;
function LIST(type) { return { tag: "list", content_type: type }; }
exports.LIST = LIST;
;
