import "mocha";
import { expect } from "chai";
import { BitMappedBlocks } from "../heap";
import {TAG_CLASS} from "../gc";

describe("Heap", () => {

  // Unit tests for BitMappedBlock heap implementation
  describe("BitMappedBlock", () => {

    // Test for block allocation strategy
    describe("Number of blocks", () => {

      let bmb: BitMappedBlocks;

      beforeEach(() => {
        // 90 blocks of size 10 each
        bmb = new BitMappedBlocks(100n, 1000n, 10n, 8n);
      });

      it("Should initialize with correct number of blocks", () => {
        expect(bmb.getNumFreeBlocks()).to.eq(90);
      })
  
      it("Should allocate appropriate number of blocks", () => {
        const ptr = bmb.gcalloc(TAG_CLASS, 25n);
        // Three blocks are allocated for request of size 25
        expect(bmb.getNumFreeBlocks()).to.eq(87);
      });

      it("Should return an invalid pointer if request exceeds available memory", () => {
        // 901 > 900, the total available  memory
        const ptr = bmb.gcalloc(TAG_CLASS, 901n);
        expect(ptr).to.eq(0x0n);
      });


    });
  });
})