import type { StoredEntity } from "../lib/db";

export interface StoredEntityOptions {
  id?: string;
  now?: () => string;
}

export function createStoredEntity<TPayload>(
  payload: TPayload,
  name: string,
  idPrefix: string,
  options: StoredEntityOptions = {},
): StoredEntity<TPayload> {
  const now = options.now?.() ?? new Date().toISOString();

  return {
    id: options.id ?? createEntityId(idPrefix),
    name,
    createdAt: now,
    updatedAt: now,
    payload,
  };
}

export function createEntityId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.\\/]+$/, "");
}
