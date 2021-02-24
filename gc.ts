import * as H from "./heap";

export class MnS {
  // heap: Segregator<500, Segregator<100, BitMappedBlocks<100>, BitMappedBlocks<500>>, AllocList>;
  heap: H.Segregator<500n,
    H.Segregator<100n, H.BumpAllocator, H.BumpAllocator>,
    H.BumpAllocator
  >;
}
