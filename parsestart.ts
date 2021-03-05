import { parse } from "./parser";
import { Program } from "./ast";

// var result = parse(`
// def f(x : int):
//     y : int = 0
//     y = y + 2
//     return x + y

// x : int = 0

// y : bool = True

// x = 2

// x = x + x`);

// var result = parse(`
// x : int = 0
// x = x + 2
// `);

var result = parse(`
import numpy as np
a : np = None
a = np.array(10)`);

// reference: https://stackoverflow.com/questions/58249954/json-stringify-and-postgresql-bigint-compliance
function toJson(data: Program<null>) {
    if (data !== undefined) {
        let intCount = 0, repCount = 0;
        const json = JSON.stringify(data, (_, v) => {
            if (typeof v === 'bigint') { // handles bigint
                intCount++;
                return `${v}#bigint`;
            }
            return v;
        }, 2);
        const res = json.replace(/"(-?\d+)#bigint"/g, (_, a) => {
            repCount++;
            return a;
        });
        if (repCount > intCount) {
            // You have a string somewhere that looks like "123#bigint";
            throw new Error(`BigInt serialization conflict with a string value.`);
        }
        return res;
    }
}

console.log(toJson(result));
// console.log(JSON.stringify(result, null, 4));
