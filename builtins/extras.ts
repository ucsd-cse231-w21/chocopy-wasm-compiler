// -*- mode: typescript; typescript-indent-level: 2; -*-

export function malloc(importObject: any) {
  return (bytes: any): any => {
    const memBuffer: ArrayBuffer = (importObject as any).js.memory.buffer;
    const memUint8 = new Uint8Array(memBuffer);
    const memUint64 = new BigUint64Array(memBuffer);
    
    // Get the current heap pointer
    const heapPtrBuffer = importObject.js.memory.buffer.slice(0, 8);
    const heapPtrDV = new DataView(heapPtrBuffer, 0, 8);
    const heapPtr = Number(heapPtrDV.getBigUint64(0, true));

    // Write the new heap pointer
    memUint64[0] = BigInt(heapPtr + bytes);

    return BigInt(heapPtr);
  };
}
