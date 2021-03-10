import "mocha";
import { expect } from "chai";
import { BitMappedBlocks } from "../heap";
import {TAG_CLASS, TAG_REF, HEADER_SIZE_BYTES} from "../gc";

describe("Heap", () => {

  // Unit tests for BitMappedBlock heap implementation
  describe("BitMappedBlock", () => {

    // Problematic allocation requests
    // Based on failing tests/programs
    describe("Problematic alloc pattern", () => {
      it("Closure test 7 alloc pattern", () => {
        const bmb = new BitMappedBlocks(516n, 2000n, 4n, BigInt(HEADER_SIZE_BYTES));

        const ptr0 = bmb.gcalloc(TAG_REF, 4n);
        expect(bmb.infomap[0]).to.eq(1);
        expect(Number(ptr0)).to.eq(516);

        const ptr1 = bmb.gcalloc(TAG_REF, 4n);
        expect(bmb.infomap[0]).to.eq(1);
        expect(bmb.infomap[9]).to.eq(1);
        expect(Number(ptr1)).to.eq(520);

        const ptr2 = bmb.gcalloc(TAG_REF, 4n);
        expect(bmb.infomap[0]).to.eq(1);
        expect(bmb.infomap[9]).to.eq(1);
        expect(bmb.infomap[18]).to.eq(1);
        expect(Number(ptr2)).to.eq(524);

        const ptr3 = bmb.gcalloc(TAG_REF, 4n);
        expect(bmb.infomap[0]).to.eq(1);
        expect(bmb.infomap[9]).to.eq(1);
        expect(bmb.infomap[18]).to.eq(1);
        expect(bmb.infomap[27]).to.eq(1);
        expect(Number(ptr3)).to.eq(528);

        const ptr4 = bmb.gcalloc(TAG_REF, 4n);
        expect(bmb.infomap[0]).to.eq(1);
        expect(bmb.infomap[9]).to.eq(1);
        expect(bmb.infomap[18]).to.eq(1);
        expect(bmb.infomap[27]).to.eq(1);
        expect(bmb.infomap[36]).to.eq(1);
        expect(Number(ptr4)).to.eq(532);

        const ptr5 = bmb.gcalloc(TAG_REF, 4n);
        expect(Number(ptr5)).to.eq(536);

        const ptr6 = bmb.gcalloc(TAG_REF, 4n);
        expect(Number(ptr6)).to.eq(540);
      });
    });


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
        const ptr1 = bmb.gcalloc(TAG_CLASS, 25n);
        // Three blocks are allocated for request of size 25
        expect(Number(ptr1)).to.eq(100);
        expect(bmb.getNumFreeBlocks()).to.eq(87);

        const ptr2 = bmb.gcalloc(TAG_CLASS, 25n);
        expect(Number(ptr2)).to.eq(130);
        expect(bmb.getNumFreeBlocks()).to.eq(84);
      });

      it("Should allocate appropriate number of blocks 2", () => {
        const ptr1 = bmb.gcalloc(TAG_CLASS, 10n);
        // Three blocks are allocated for request of size 25
        expect(Number(ptr1)).to.eq(100);
        expect(bmb.getNumFreeBlocks()).to.eq(89);

        const ptr2 = bmb.gcalloc(TAG_CLASS, 10n);
        expect(Number(ptr2)).to.eq(110);
        expect(bmb.getNumFreeBlocks()).to.eq(88);
      });

      it("Should allocate appropriate number of blocks 3", () => {
        const ptr1 = bmb.gcalloc(TAG_CLASS, 4n);
        // Three blocks are allocated for request of size 25
        expect(Number(ptr1)).to.eq(100);
        expect(bmb.getNumFreeBlocks()).to.eq(89);

        const ptr2 = bmb.gcalloc(TAG_CLASS, 8n);
        expect(Number(ptr2)).to.eq(110);
        expect(bmb.getNumFreeBlocks()).to.eq(88);
      });

      it("Should return an invalid pointer if request exceeds available memory", () => {
        // 901 > 900, the total available  memory
        const ptr = bmb.gcalloc(TAG_CLASS, 901n);
        // Number(0x0n) = 0
        expect(Number(ptr)).to.eq(0);
      });
    });
  });
});
