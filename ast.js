"use strict";
// import { TypeCheckError } from "./type-check";
exports.__esModule = true;
exports.UniOp = exports.BinOp = void 0;
// TODO: should we split up arithmetic ops from bool ops?
var BinOp;
(function (BinOp) {
    BinOp[BinOp["Plus"] = 0] = "Plus";
    BinOp[BinOp["Minus"] = 1] = "Minus";
    BinOp[BinOp["Mul"] = 2] = "Mul";
    BinOp[BinOp["IDiv"] = 3] = "IDiv";
    BinOp[BinOp["Mod"] = 4] = "Mod";
    BinOp[BinOp["Eq"] = 5] = "Eq";
    BinOp[BinOp["Neq"] = 6] = "Neq";
    BinOp[BinOp["Lte"] = 7] = "Lte";
    BinOp[BinOp["Gte"] = 8] = "Gte";
    BinOp[BinOp["Lt"] = 9] = "Lt";
    BinOp[BinOp["Gt"] = 10] = "Gt";
    BinOp[BinOp["Is"] = 11] = "Is";
    BinOp[BinOp["And"] = 12] = "And";
    BinOp[BinOp["Or"] = 13] = "Or";
})(BinOp = exports.BinOp || (exports.BinOp = {}));
;
var UniOp;
(function (UniOp) {
    UniOp[UniOp["Neg"] = 0] = "Neg";
    UniOp[UniOp["Not"] = 1] = "Not";
})(UniOp = exports.UniOp || (exports.UniOp = {}));
;
