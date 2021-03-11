import "mocha";
import { expect } from "chai";
import { BitMappedBlocks } from "../heap";
import {TAG_CLASS, TAG_REF, HEADER_SIZE_BYTES, TAG_LIST} from "../gc";

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

      it("Should fail if contiguous block of memory is unvailable", () => {
        const ptr = bmb.gcalloc(TAG_CLASS, 500n);
        const ptr2 = bmb.gcalloc(TAG_CLASS, 20n);
        const ptr3 = bmb.gcalloc(TAG_CLASS, 370n);

        // 20 bytes free in the middle, 10 at the end
        bmb.free2(ptr2);

        // No contiguous 25 bytes available
        const reqPtr = bmb.gcalloc(TAG_CLASS, 25n);

        expect(Number(reqPtr)).to.eq(0);
      });
    });

    describe("Freeing blocks", () => {
      let bmb: BitMappedBlocks;

      beforeEach(() => {
        // 90 blocks of size 10 each
        bmb = new BitMappedBlocks(100n, 1000n, 10n, 8n);
      });

      it("returns the right index for the first free available block", () => {
        console.log(bmb.getBlockIndex(10n))
        expect(Number(bmb.getBlockIndex(10n))).to.eq(0);
      });

      it("return the right index for the first free available block 2", () => {
        const ptr = bmb.gcalloc(TAG_CLASS, 10n);
        const ptr2 = bmb.gcalloc(TAG_CLASS, 20n);
        const ptr3 = bmb.gcalloc(TAG_CLASS, 10n);

        bmb.free2(ptr2);

        // Anything smaller than 10 => 1
        expect(Number(bmb.getBlockIndex(8n))).to.eq(1);
      });
      
    });

    describe("misc", () => {
      let bmb: BitMappedBlocks;

      beforeEach(() => {
        // 90 blocks of size 10 each
        bmb = new BitMappedBlocks(100n, 1000n, 10n, 8n);
      });

      it("should return true for any pointer value between 100 and 1000", () => {
        expect(bmb.owns(833n)).to.eq(true);
      });

      it("should return false for values outside", () => {
        expect(bmb.owns(1021n)).to.eq(false);
      });

      it("should return appropriate header", () => {
        const size = 100n;
        const tag = TAG_LIST;
        
        const ptr = bmb.gcalloc(tag, size);

        const header = bmb.getHeader(ptr);

        expect(header.getTag()).to.eq(tag);
        expect(header.getSize()).to.eq(size);
      });

      it("should return the appropriate description", () => {
        const expectedStr = `BitMapped { Max blocks: ${90}, block size: ${10}, free blocks: ${90}, start: ${100}, end: ${1000}, metadataSize: ${9} } `
        expect(bmb.description()).to.eq(expectedStr);
      });

      it("should store number of blocks used instead of 0/1", () => {
        // 55 => 6 blocks
        const ptr = bmb.gcalloc(TAG_CLASS, 55n);
        expect(bmb.infomap[0]).to.eq(6);
      });
    });

    describe("sweep", () => {
      let bmb: BitMappedBlocks;

      beforeEach(() => {
        // 90 blocks of size 10 each
        bmb = new BitMappedBlocks(100n, 1000n, 10n, 8n);
      });

      it("should have the same number of blocks when sweep is called if none are marked", () => {
        const ptr1 = bmb.gcalloc(TAG_CLASS, 55n);
        const ptr2 = bmb.gcalloc(TAG_CLASS, 55n);
        const ptr3 = bmb.gcalloc(TAG_CLASS, 55n);
        const ptr4 = bmb.gcalloc(TAG_CLASS, 63n);
        const ptr5 = bmb.gcalloc(TAG_CLASS, 55n);

        [ptr1, ptr2, ptr3, ptr4, ptr5].forEach((ptr) => bmb.getHeader(ptr).mark());

        const numFreeBlocks = bmb.getNumFreeBlocks();
        bmb.sweep();
        // No change - No blocks un-marked
        expect(bmb.getNumFreeBlocks()).to.eq(numFreeBlocks);
      });

      it("should return appropriate number of free blocks after sweep", () => {
        const ptr1 = bmb.gcalloc(TAG_CLASS, 55n);
        const ptr2 = bmb.gcalloc(TAG_CLASS, 55n); // 6 blocks
        const ptr3 = bmb.gcalloc(TAG_CLASS, 55n);
        const ptr4 = bmb.gcalloc(TAG_CLASS, 63n); // 7 blocks
        const ptr5 = bmb.gcalloc(TAG_CLASS, 55n);

        const numFreeBlocks = bmb.getNumFreeBlocks();

        [ptr1, ptr3, ptr5].forEach((ptr) => bmb.getHeader(ptr).mark());

        // 13 blocks(ptr2 and ptr4) not marked - will be freed by sweep
        
        bmb.sweep();

        // freeBlocks = numFreeBlocks + 13
        expect(bmb.getNumFreeBlocks()).to.eq(numFreeBlocks + 13);
      });
    });
  });
});
