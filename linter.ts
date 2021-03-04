export function prettifyWasmSource(wasmSource: string): string {
    const split = wasmSource.split("\n");
    var processed: Array<string> = [];

    var curOff = 0;
    split.forEach(line => {
	var scratch =line.trim();
	
	scratch = " ".repeat(curOff*4) + scratch;
	const oB = scratch.match(/\(/g);
	const cB = scratch.match(/\)/g);

	const oBCount = oB == null ? 0 : oB.length;
	const cBCount = cB == null ? 0 : cB.length;

	if (cBCount < oBCount)
	    curOff += (oBCount-cBCount);
	else if (cBCount > oBCount)
	    curOff -= (cBCount-oBCount);

	processed.push(scratch);
    });
    return processed.join("\n");
}
