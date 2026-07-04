import type { CharacterCard } from "../types/character";
import { decodeCharacterCardFromPng, writeCharacterCardToPng } from "./png";

export type CharacterCardImportFormat = "png" | "json";

export interface ImportedCharacterCard {
  card: CharacterCard;
  format: CharacterCardImportFormat;
  fileName?: string;
}

export class CharacterCardImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CharacterCardImportError";
  }
}

export function importCharacterCardFromBytes(
  bytes: Uint8Array,
  fileName: string,
): ImportedCharacterCard {
  const format = inferCardFormat(fileName);

  if (format === "png") {
    return {
      card: decodeCharacterCardFromPng(bytes),
      format,
      fileName,
    };
  }

  return {
    card: parseCharacterCardJson(new TextDecoder().decode(bytes)),
    format,
    fileName,
  };
}

export function parseCharacterCardJson(json: string): CharacterCard {
  const value = JSON.parse(json) as unknown;

  if (!isCharacterCard(value)) {
    throw new CharacterCardImportError("JSON is not a supported character card.");
  }

  return value;
}

export function serializeCharacterCardJson(
  card: CharacterCard,
  space: number | undefined = 2,
): string {
  return JSON.stringify(card, null, space);
}

export function encodeCharacterCardJson(
  card: CharacterCard,
  space: number | undefined = 2,
): Uint8Array {
  return new TextEncoder().encode(serializeCharacterCardJson(card, space));
}

export function exportCharacterCardToPng(
  sourcePngBytes: Uint8Array,
  card: CharacterCard,
): Uint8Array {
  return writeCharacterCardToPng(sourcePngBytes, card);
}

export function isCharacterCard(value: unknown): value is CharacterCard {
  if (!isRecord(value)) {
    return false;
  }

  if (value.spec !== "chara_card_v2" && value.spec !== "chara_card_v3") {
    return false;
  }

  if (!isRecord(value.data)) {
    return false;
  }

  return typeof value.data.name === "string";
}

function inferCardFormat(fileName: string): CharacterCardImportFormat {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".png")) {
    return "png";
  }

  if (lowerName.endsWith(".json")) {
    return "json";
  }

  throw new CharacterCardImportError(
    `Unsupported character card file extension: ${fileName}`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
