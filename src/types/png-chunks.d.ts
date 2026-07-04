declare module "png-chunks-extract" {
  import type { PngChunk } from "../lib/png";

  export default function extractChunks(data: Uint8Array): PngChunk[];
}

declare module "png-chunks-encode" {
  import type { PngChunk } from "../lib/png";

  export default function encodeChunks(chunks: PngChunk[]): Uint8Array;
}

declare module "png-chunk-text" {
  import type { PngChunk } from "../lib/png";

  export interface DecodedPngTextChunk {
    keyword: string;
    text: string;
  }

  const textChunk: {
    encode(keyword: string, content: string): PngChunk;
    decode(data: Uint8Array | PngChunk): DecodedPngTextChunk;
  };

  export default textChunk;
}
