export function augmentFnGc(fnInstrs: Array<string>, locals: Map<string, number>): Array<string> {
  let results: Array<string> = [];

  fnInstrs.forEach(wasmInstr => {
    const split = wasmInstr.split(/[ ()]/);

    for (let index = 0; index < split.length; index++) {
      const sub = split[index];
      if (index === 0 && sub !== "") {
        console.warn(`GC pass: unknown WASM: '${wasmInstr}'`);
        break;
      }

      let kontinue = true;
      if (index === 1) {
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
            break;
          }

          default:
            break;
        }
      }

      if (!kontinue) {
        break;
      }
    }

    results.push(wasmInstr);
  });

  return results;
}
