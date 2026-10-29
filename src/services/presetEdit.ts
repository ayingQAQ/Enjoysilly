import { getMySillyDatabase, type StoredPreset, type MySillyDatabaseConnection } from "../lib/db";

export function validatePresetEdit(draft: StoredPreset): void {
  if (!draft.name.trim()) throw new Error("请填写预设名称。");
  for (const key of ["temperature", "top_p", "openai_max_tokens"] as const) {
    const value = draft.payload[key];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`${key} 必须是非负有限数值。`);
    }
  }
  if (draft.payload.top_p !== undefined && draft.payload.top_p > 1) {
    throw new Error("top_p 必须在 0 到 1 之间。");
  }
  const maxTokens = draft.payload.openai_max_tokens;
  const context = draft.payload.openai_max_context;
  if (context !== undefined && (!Number.isSafeInteger(context) || context <= 0)) throw new Error("上下文上限必须是正整数。");
  if (maxTokens !== undefined && (!Number.isSafeInteger(maxTokens) || maxTokens <= 0)) {
    throw new Error("最大输出长度必须是正整数。");
  }
  const identifiers = new Set<string>();
  for (const prompt of draft.payload.prompts) {
    if (!prompt.identifier.trim() || identifiers.has(prompt.identifier)) {
      throw new Error("提示词标识不能为空或重复。");
    }
    identifiers.add(prompt.identifier);
  }
}

export async function savePresetEdit(original: StoredPreset, draft: StoredPreset, database?: MySillyDatabaseConnection) {
  validatePresetEdit(draft);
  const db = database ?? await getMySillyDatabase();
  const tx = db.transaction("presets", "readwrite");
  const current = await tx.store.get(original.id);
  if (!current || JSON.stringify(current) !== JSON.stringify(original)) {
    await tx.done;
    throw new Error("预设已被修改或删除，请关闭编辑器后重新打开。");
  }
  const updated = { ...structuredClone(draft), id: original.id, updatedAt: new Date().toISOString() };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}
