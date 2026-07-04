import type { CharacterCard } from "../types/character";
import encodeChunks from "png-chunks-encode";
import extractChunks from "png-chunks-extract";
import textChunk from "png-chunk-text";

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface PngChunk {
  name: string;
  data: Uint8Array;
}

export interface PngTextChunk {
  keyword: string;
  value: string;
  chunkIndex: number;
}

export class PngParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PngParseError";
  }
}

export interface WriteCharacterCardPngOptions {
  keyword?: "chara" | "ccv3";
  includeLegacyChara?: boolean;
}

export function readPngTextChunks(bytes: Uint8Array): PngTextChunk[] {
  assertPngSignature(bytes);

  const chunks: PngTextChunk[] = [];
  let offset = pngSignature.length;
  let chunkIndex = 0;

  while (offset + 12 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    const type = decodeAscii(bytes.subarray(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (dataEnd + 4 > bytes.length) {
      throw new PngParseError(`PNG chunk ${type} exceeds file length.`);
    }

    const data = bytes.subarray(dataStart, dataEnd);

    if (type === "tEXt") {
      const separatorIndex = data.indexOf(0);

      if (separatorIndex > -1) {
        chunks.push({
          keyword: decodeLatin1(data.subarray(0, separatorIndex)),
          value: decodeLatin1(data.subarray(separatorIndex + 1)),
          chunkIndex,
        });
      }
    }

    offset = dataEnd + 4;
    chunkIndex += 1;

    if (type === "IEND") {
      break;
    }
  }

  return chunks;
}

export function decodeCharacterCardFromPng(bytes: Uint8Array): CharacterCard {
  const chunks = readPngTextChunks(bytes);
  const cardChunk =
    chunks.find((chunk) => chunk.keyword === "ccv3") ??
    chunks.find((chunk) => chunk.keyword === "chara");

  if (!cardChunk) {
    throw new PngParseError("PNG does not contain a ccv3 or chara tEXt chunk.");
  }

  return JSON.parse(decodeBase64Utf8(cardChunk.value)) as CharacterCard;
}

export function writeCharacterCardToPng(
  bytes: Uint8Array,
  card: CharacterCard,
  options: WriteCharacterCardPngOptions = {},
): Uint8Array {
  assertPngSignature(bytes);

  const chunks = extractChunks(bytes);
  const keyword = options.keyword ?? defaultCardKeyword(card);
  const cardChunks = [createCharacterCardTextChunk(card, keyword)];

  if (options.includeLegacyChara && keyword === "ccv3") {
    cardChunks.push(createCharacterCardTextChunk(card, "chara"));
  }

  const withoutCardChunks = chunks.filter(
    (chunk) => !isCharacterCardTextChunk(chunk),
  );
  const iendIndex = withoutCardChunks.findIndex((chunk) => chunk.name === "IEND");

  if (iendIndex < 0) {
    throw new PngParseError("PNG does not contain an IEND chunk.");
  }

  const nextChunks = [
    ...withoutCardChunks.slice(0, iendIndex),
    ...cardChunks,
    ...withoutCardChunks.slice(iendIndex),
  ];

  return encodeChunks(nextChunks);
}

export function createCharacterCardTextChunk(
  card: CharacterCard,
  keyword = defaultCardKeyword(card),
): PngChunk {
  return textChunk.encode(keyword, encodeBase64Utf8(JSON.stringify(card)));
}

function isCharacterCardTextChunk(chunk: PngChunk): boolean {
  if (chunk.name !== "tEXt") {
    return false;
  }

  const decoded = textChunk.decode(chunk);
  return decoded.keyword === "chara" || decoded.keyword === "ccv3";
}

function defaultCardKeyword(card: CharacterCard): "chara" | "ccv3" {
  return card.spec === "chara_card_v3" ? "ccv3" : "chara";
}

function assertPngSignature(bytes: Uint8Array): void {
  if (bytes.length < pngSignature.length) {
    throw new PngParseError("File is too short to be a PNG.");
  }

  const isPng = pngSignature.every((byte, index) => bytes[index] === byte);

  if (!isPng) {
    throw new PngParseError("File does not have a valid PNG signature.");
  }
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function decodeAscii(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

function decodeLatin1(bytes: Uint8Array): string {
  let output = "";

  for (const byte of bytes) {
    output += String.fromCharCode(byte);
  }

  return output;
}

function decodeBase64Utf8(value: string): string {
  if (typeof globalThis.atob !== "function") {
    throw new PngParseError("Base64 decoding is not available in this runtime.");
  }

  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value: string): string {
  if (typeof globalThis.btoa !== "function") {
    throw new PngParseError("Base64 encoding is not available in this runtime.");
  }

  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return globalThis.btoa(binary);
}
