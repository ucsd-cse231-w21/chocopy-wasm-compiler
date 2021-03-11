export type AugmentConfig = {
  main: boolean;
  debug?: {
    name: string;
  };
};

const DEBUG = true;

function makeHash(s: string): number {
  var hash = 0,
    i,
    chr;
  if (s.length === 0) return hash;
  for (i = 0; i < s.length; i++) {
    chr = s.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

export function augmentFnGc(
  fnInstrs: Array<string>,
  locals: Map<string, number>,
  cfg: AugmentConfig
): Array<string> {
  let results: Array<string> = [];

  let afterLocals = false;
  fnInstrs.forEach((wasmInstr, wasmIndex) => {
    const split = wasmInstr.split(/[ ()]/);

    // console.warn(`[${wasmIndex}]: scanning '${wasmInstr}'`);
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

          if (cfg.debug && DEBUG) {
            // NOTE(alex:mm): used to trace function/allocation calls
            // const debug = cfg.debug;
            // const id = makeHash(debug.name);
            // console.warn(`${debug.name} => ${id}`);
            // results.push(`;; ${debug.name} ${id}`);
            // results.push(`(i32.const ${id})`);
            // results.push(`(call $$DEBUG)`);
          }
          afterLocals = true;
        }

        switch (sub) {
          case "local.set": {
            const varName = split[index + 1].substring(1);
            // NOTE(alex: mm): $$locals are considered internal and non-rooted
            // Any rooting should be captured by temporary sets
            results.push(wasmInstr);
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
            break;
          }

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

          case "call_indirect": {
            // console.warn(`[${wasmIndex}]: guarding '${wasmInstr}'`);
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
            if (!cfg.main) {
              results.push("(call $$returnTemp)");
            }
            results.push("(call $$releaseLocals)");
            results.push(wasmInstr);
            kontinue = false;
            break;
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
