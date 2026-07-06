import {
  createStoredEntity,
  stripFileExtension,
} from "./entityMetadata";
import {
  saveQuickReplySet,
  type MySillyDatabaseConnection,
  type StoredQuickReplySet,
} from "../lib/db";
import {
  createQuickReplyFileName,
  encodeQuickReplySetJson,
  parseQuickReplySetJson,
} from "../lib/quickReplyIO";
import type { QuickReplySet } from "../types/quickReply";

export interface QuickReplyImportResult {
  stored: StoredQuickReplySet;
  set: QuickReplySet;
  fileName: string;
}

export function createStoredQuickReplySet(
  set: QuickReplySet,
  fileName: string,
): StoredQuickReplySet {
  const name = set.name && set.name.trim().length > 0
    ? set.name
    : stripFileExtension(fileName);

  return createStoredEntity<QuickReplySet>(set, name, "qr_") as StoredQuickReplySet;
}

export async function importQuickReplySetToDatabase(
  json: string,
  fileName: string,
  options: { database?: MySillyDatabaseConnection } = {},
): Promise<QuickReplyImportResult> {
  const set = parseQuickReplySetJson(json);
  const stored = createStoredQuickReplySet(set, fileName);

  await saveQuickReplySet(stored, options.database);

  return { stored, set, fileName };
}

export function createQuickReplySetExport(set: QuickReplySet): {
  fileName: string;
  bytes: Uint8Array;
} {
  return {
    fileName: createQuickReplyFileName(set.name),
    bytes: encodeQuickReplySetJson(set),
  };
}
