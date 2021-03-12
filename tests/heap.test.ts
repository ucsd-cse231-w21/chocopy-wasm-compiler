import "mocha";
import { expect } from "chai";
import { BitMappedBlocks, FreeListAllocator } from "../heap";
import {
  MarkableSegregator,
  TAG_CLASS,
  TAG_CLOSURE,
  TAG_REF,
  HEADER_SIZE_BYTES,
  TAG_LIST,
} from "../gc";

describe("Heap", () => {
  // Unit tests for BitMappedBlock heap implementation
  describe("BitMappedBlock", () => {
    // Problematic allocation requests
    // Based on failing tests/programs
    describe("Problematic alloc pattern", () => {
      it("Closure test 7 alloc pattern part2", () => {
        const bmb = new BitMappedBlocks(516n, 772n, 4n, BigInt(HEADER_SIZE_BYTES));
        const fl = new BitMappedBlocks(772n, 2000n, 4n, BigInt(HEADER_SIZE_BYTES));
        const heap = new MarkableSegregator(4n, bmb, fl);

        const ptr0 = heap.gcalloc(TAG_REF, 4n);
        const ptr1 = heap.gcalloc(TAG_REF, 4n);
        const ptr2 = heap.gcalloc(TAG_REF, 4n);
        const ptr3 = heap.gcalloc(TAG_REF, 4n);
        const ptr4 = heap.gcalloc(TAG_REF, 4n);

        const ptr5 = heap.gcalloc(TAG_CLOSURE, 8n);
        const ptr6 = heap.gcalloc(TAG_CLOSURE, 8n);
        const ptr7 = heap.gcalloc(TAG_CLOSURE, 8n);
        const ptr8 = heap.gcalloc(TAG_CLOSURE, 12n);

        const header0 = heap.getHeader(ptr0);
        expect(Number(ptr0)).to.eq(516);
        expect(Number(header0.getSize())).to.eq(4);
        expect(Number(header0.getTag())).to.eq(Number(TAG_REF));
      });

      it("Closure test 7 alloc pattern", () => {
        const bmb = new BitMappedBlocks(516n, 2000n, 4n, BigInt(HEADER_SIZE_BYTES));

        const ptr0 = bmb.gcalloc(TAG_REF, 4n);
        expect(bmb.infomap[0]).to.eq(1);
        expect(Number(ptr0)).to.eq(516);

        const ptr1 = bmb.gcalloc(TAG_REF, 4n);
        const header1 = bmb.getHeader(ptr1);
        expect(header1.isAlloced()).to.eq(true);
        expect(Number(header1.getSize())).to.eq(4);
        expect(Number(header1.getTag())).to.eq(Number(TAG_REF));
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
      });

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
        console.log(bmb.getBlockIndex(10n));
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
        const expectedStr = `BitMapped { Max blocks: ${90}, block size: ${10}, free blocks: ${90}, start: ${100}, end: ${1000}, metadataSize: ${9} } `;
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

  // Unit tests for FreeList heap implementation
  describe("FreeList", () => {
    // Test for node addition to the LinkedList (Allocation)
    describe("Allocation", () => {
      let fl: FreeListAllocator;
      let allocatedAddr: any;
      let allocatedNode: any;

      beforeEach(() => {
        // NOTE(alex:mm): address 0 is reserved for `None` values
        //Total size of 1400 with start at 4n and end at 1200n
        var arr = new Uint8Array(1400);
        fl = new FreeListAllocator(arr, 4n, 1200n);
      });

      // Checking for gcalloc:
      it("Should return NULL value if request exceeds available memory", () => {
        // 1300n > 1200n, the total available memory
        expect(fl.gcalloc(TAG_CLASS, 1300n)).to.eq(0x0n);
      });

      it("Should return appropriate Block address if sucessfully allocated", () => {
        // 1200n > 1000n, the total available memory
        expect(Number(fl.gcalloc(TAG_CLASS, 1000n))).to.eq(200);
      });

      it("Should return an appropriate block that can accomodate the given size", () => {
        let allocatedAddr2 = fl.gcalloc(TAG_CLASS, 50n);
        var allocatedNode = fl.linkedList.getNode(allocatedAddr2);
        expect(Number(allocatedAddr2 - BigInt(HEADER_SIZE_BYTES))).to.eql(
          Number(allocatedNode.data.addr)
        );
      });

      // Checking for alloc:
      it("Should return appropriate address of block that has been allocated", () => {
        // Header takes up 8 bytes starting at 192n
        let { ptr, size } = fl.alloc(1000n);
        expect({ ptr: Number(ptr), size: Number(size) }).to.eql({ ptr: 200, size: 1000 });
      });

      it("Should return NULL incase the requested size cannot be accomodated", () => {
        const { ptr, size } = fl.alloc(1300n);
        expect({ ptr: Number(ptr), size: Number(size) }).to.eql({ ptr: 0, size: 0 });
      });
    });

    describe("Sweep", () => {
      let fl: FreeListAllocator;
      let allocatedAddr1: any;
      let allocatedAddr2: any;

      beforeEach(() => {
        // NOTE(alex:mm): address 0 is reserved for `None` values
        // Total size of 1400 with start at 4 and end at 1200
        var arr = new Uint8Array(1400);
        fl = new FreeListAllocator(arr, 4n, 1200n);
      });

      it("Should return the correct number of Nodes in the LinkedList once sweep() is called", () => {
        allocatedAddr1 = fl.gcalloc(TAG_CLASS, 100n);
        allocatedAddr2 = fl.gcalloc(TAG_CLASS, 100n);
        // There are 4 Nodes in the LinkedList at this point (start, allocatedNode1, allocatedNode2, end)
        expect(fl.linkedList.size()).to.eq(4);

        // Only the first allocated Node is marked
        fl.getHeader(allocatedAddr1).mark();
        // Once sweep() is called, all unmarked objects are freed and those Nodes are coalesced with adjacent Free nodes
        fl.sweep();

        // There are 3 Nodes in the LinkedList at this point (start, allocatedNode2, end)
        expect(fl.linkedList.size()).to.eq(3);
      });
    });

    describe("Miscellaneous", () => {
      let fl: FreeListAllocator;

      beforeEach(() => {
        // Total size of 1400 with start at 0 and end at 1200
        var arr = new Uint8Array(1400);
        fl = new FreeListAllocator(arr, 0n, 1200n);
      });

      it("Should return the correct description of the current LinkedList", () => {
        const expectedStr = `FreeList { start: ${0}, end: ${1200} }`;
        expect(fl.description()).to.eq(expectedStr);
      });

      it("Should return FALSE if value requested exceeds available memory", () => {
        // 1300n > 1200n, the total available memory
        expect(fl.owns(1300n)).to.eq(false);
      });

      it("Should return TRUE if value requested lies within the range of available memory", () => {
        // 700n < 1200n, the total available memory
        expect(fl.owns(700n)).to.eq(true);
      });

      it("Should return the appropriate Header requested", () => {
        const size = 100n;
        const tag = TAG_LIST;

        const ptr = fl.gcalloc(tag, size);

        const header = fl.getHeader(ptr);

        expect(header.getTag()).to.eq(tag);
        expect(header.getSize()).to.eq(size);
      });
    });

    describe("LinkedList", () => {
      let fl: FreeListAllocator;
      let allocatedAddr: any;
      let allocatedNode: any;

      beforeEach(() => {
        //Total size of 1400 with start at 0n and end at 1200n
        var arr = new Uint8Array(1400);
        fl = new FreeListAllocator(arr, 0n, 1200n);
      });

      // it("Should return an array of data from all the Nodes in the LinkedList", () => {
      //   // Array of <flmd>s [{addr: {0n}, size: {192}, isFree: true}, {addr: {192n}, size: {1000}, isFree: false}, {addr: {1000n}, size: {1200}, isFree: true}]
      //   expect(fl.linkedList.traverse).to.eq("???"); // ??
      // });

      it("Should return the total size of the Initial Linkedlist", () => {
        expect(fl.linkedList.size()).to.eq(2);
      });

      it("Should return the total size of the Linkedlist after Allocation", () => {
        let { ptr, size } = fl.alloc(1000n);
        expect(fl.linkedList.size()).to.eq(3);
      });

      it("Should return the Node to the left of a given ptr in the LinkedList", () => {
        let allocatedAddr = fl.gcalloc(TAG_CLASS, 50n);
        var allocatedNode = fl.linkedList.getNode(allocatedAddr);
        expect(fl.linkedList.getPrev(allocatedNode)).to.eql(fl.linkedList.getHead());
      });

      it("Should return the Node to the right of a given ptr in the LinkedList", () => {
        let allocatedAddr = fl.gcalloc(TAG_CLASS, 50n);
        var allocatedNode = fl.linkedList.getNode(allocatedAddr);
        expect(fl.linkedList.getNext(allocatedNode)).to.eql(
          fl.linkedList.getNode(fl.regEnd + BigInt(HEADER_SIZE_BYTES))
        ); //As End Node doesn't have header
      });

      it("Should return the Data of a particular Node of type <flmd>", () => {
        let allocatedAddr = fl.gcalloc(TAG_CLASS, 1000n);
        var allocatedNode = fl.linkedList.getNode(allocatedAddr);
        expect(fl.linkedList.getData(allocatedNode)).to.eql({
          addr: 192n,
          size: 1008n,
          isFree: false,
        });
      });
    });
  });
});
