interface MnSHeap {
  isMarked(ptr: bigint);
  collect();
}

class MnS {
  heap: Segregator<500, Segregator<100, BitMappedBlocks<100>, BitMappedBlocks<500>>, AllocList>,
}
