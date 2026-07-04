import {
  getMySillyDatabase,
  getWorldInfo,
  type MySillyDatabaseConnection,
  type StoredWorldInfo,
} from "../lib/db";
import { serializeWorldInfoJson } from "../lib/worldInfoIO";
import { createSafeJsonFileName } from "./exportFileName";

export interface WorldInfoJsonExport {
  fileName: string;
  bytes: Uint8Array;
  stored: StoredWorldInfo;
}

export async function createWorldInfoJsonExport(
  worldInfoId: string,
  database?: MySillyDatabaseConnection,
): Promise<WorldInfoJsonExport> {
  const db = database ?? (await getMySillyDatabase());
  const stored = await getWorldInfo(worldInfoId, db);

  if (!stored) {
    throw new Error(`找不到世界书：${worldInfoId}`);
  }

  return {
    fileName: createWorldInfoJsonFileName(stored.name),
    bytes: new TextEncoder().encode(serializeWorldInfoJson(stored.payload)),
    stored,
  };
}

export function createWorldInfoJsonFileName(name: string): string {
  return createSafeJsonFileName(name, "world-info");
}
