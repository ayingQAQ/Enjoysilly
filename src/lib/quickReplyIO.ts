import type { QuickReplyItem, QuickReplySet } from "../types/quickReply";

export function parseQuickReplySetJson(json: string): QuickReplySet {
  const parsed: unknown = JSON.parse(json);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Quick Reply JSON must be an object.");
  }

  const record = parsed as Record<string, unknown>;
  const version =
    typeof record.version === "string" || typeof record.version === "number"
      ? record.version
      : undefined;
  const name = typeof record.name === "string" && record.name.trim().length > 0
    ? record.name.trim()
    : "未命名快捷回复";

  if (!Array.isArray(record.qrList)) {
    throw new Error("Quick Reply JSON is missing qrList array.");
  }

  const qrList = record.qrList
    .map((item, index) => parseQuickReplyItem(item, index))
    .filter((item): item is QuickReplyItem => item !== null);

  const knownTopFields = new Set(["version", "name", "qrList"]);
  const set: QuickReplySet = { name, qrList };

  if (version) {
    set.version = version;
  }

  for (const key of Object.keys(record)) {
    if (!knownTopFields.has(key)) {
      (set as Record<string, unknown>)[key] = record[key];
    }
  }

  return set;
}

export function serializeQuickReplySetJson(set: QuickReplySet): string {
  const knownTopFields = new Set(["version", "name", "qrList"]);
  const obj: Record<string, unknown> = {
    name: set.name,
    qrList: set.qrList.map(serializeQuickReplyItem),
  };

  if (set.version !== undefined) {
    obj.version = set.version;
  }

  for (const [key, value] of Object.entries(set)) {
    if (!knownTopFields.has(key) && value !== undefined) {
      obj[key] = value;
    }
  }

  return JSON.stringify(obj, null, 2);
}

export function encodeQuickReplySetJson(set: QuickReplySet): Uint8Array {
  return new TextEncoder().encode(serializeQuickReplySetJson(set));
}

export function createQuickReplyFileName(name: string): string {
  const safe = name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .slice(0, 80);

  return `${safe || "quick-reply"}.json`;
}

const knownQrItemFields = new Set([
  "label",
  "message",
  "isAuto",
  "trigger",
]);

function parseQuickReplyItem(value: unknown, index: number): QuickReplyItem | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const label = typeof record.label === "string" && record.label.trim().length > 0
    ? record.label
    : `QR #${index + 1}`;
  const message = typeof record.message === "string" ? record.message : "";

  const item: QuickReplyItem = { label, message };

  if (record.isAuto === true) {
    item.isAuto = true;
  }

  if (typeof record.trigger === "string" && record.trigger.length > 0) {
    item.trigger = record.trigger;
  }

  for (const key of Object.keys(record)) {
    if (!knownQrItemFields.has(key)) {
      (item as Record<string, unknown>)[key] = record[key];
    }
  }

  return item;
}

function serializeQuickReplyItem(item: QuickReplyItem): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    label: item.label,
    message: item.message,
  };

  if (item.isAuto === true) {
    obj.isAuto = true;
  }

  if (typeof item.trigger === "string" && item.trigger.length > 0) {
    obj.trigger = item.trigger;
  }

  for (const [key, value] of Object.entries(item)) {
    if (!knownQrItemFields.has(key) && value !== undefined) {
      obj[key] = value;
    }
  }

  return obj;
}
