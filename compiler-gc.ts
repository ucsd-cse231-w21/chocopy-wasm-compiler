export function augmentFnGc(fnInstrs: Array<string>, locals: Map<string, number>, main: boolean): Array<string> {
  let results: Array<string> = [];

  let afterLocals = false;
  fnInstrs.forEach((wasmInstr, instrIndex) => {
    const split = wasmInstr.split(/[ ()]/);

    for (let index = 0; index < split.length; index++) {
      const sub = split[index];
      if (index === 0 && sub !== "") {
        console.warn(`GC pass: unknown WASM: '${wasmInstr}'`);
        results.push(wasmInstr);
        break;
      }

      let kontinue = true;
      if (index === 1) {
        if (sub !== "local" && !afterLocals) {
          results.push("(call $$pushFrame)");
          afterLocals = true;
        }

        switch (sub) {
          case "local.set": {
            const varName = split[index + 1].substring(1);
            // NOTE(alex: mm): $$locals are considered internal and non-rooted
            // Any rooting should be captured by temporary sets
            if (varName[0] !== "$") {
              const localIndex = locals.get(varName);
              if (localIndex === undefined) {
                throw new Error(`ICE(GC pass): Unknown local slot: ${varName}`);
              }
              results.push(`(i32.const ${localIndex.toString()})`);
              results.push(`(local.get $${varName})`);
              results.push(`(call $$addLocal)`);
            }
            kontinue = false;
            results.push(wasmInstr);
            break;
          }

          case "call_indirect":
          case "call": {
            const f = split[index + 1];
            if (sub === "call" && f.substring(0, 2) === "$$") {
              // Internal function
              results.push(wasmInstr);
              kontinue = false;
              break;
            }
            results.push(`(call $$pushCaller)`);
            results.push(wasmInstr);
            results.push(`(call $$popCaller)`);
            kontinue = false;
            break;
          }

          case "return": {
            // returnTemp places the return expr value into the caller's temp set
            // NOTE(alex:mm): We need to put temporaries and escaping pointers into
            //   the calling statement's temp frame, not a new one.
            //
            // By placing them into the calling statement's temp frame, escaping pointers
            //   have an opportunity to be rooted without fear of the GC cleaning it up
            // TODO(alex:mm): instead of relying on escape analysis, we'll just try to
            //   add the returned value to the parent temp frame
            if (!main) {
              results.push("(call $$returnTemp)");
            }
            results.push("(call $$releaseLocals)");
            results.push(wasmInstr);
            kontinue = false;
          }

          default:
            results.push(wasmInstr);
            kontinue = false;
            break;
        }
      }

      if (!kontinue) {
        break;
      }
    }
  });

  return results;
}
