import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import { openMySillyDatabase, savePreset, getPreset, type StoredPreset } from '../lib/db';
import { savePresetEdit, validatePresetEdit } from './presetEdit';
import { readFileSync } from 'node:fs';
import { parseChatCompletionPresetJson, serializeChatCompletionPresetJson } from '../lib/presetIO';

describe('preset editing', () => {
  it.each([['top_p', 1.1], ['temperature', -1], ['openai_max_tokens', 1.5], ['openai_max_tokens', 0], ['openai_max_context', 0], ['openai_max_context', 1.5]])('rejects invalid %s=%s', (key, value) => {
    const draft: StoredPreset = { id: 'p', name: 'P', createdAt: 'a', updatedAt: 'a', payload: { prompts: [], prompt_order: [], [key]: value } };
    expect(() => validatePresetEdit(draft)).toThrow();
  });

  it('rejects duplicated prompt identifiers', () => {
    const draft: StoredPreset = { id: 'p', name: 'P', createdAt: 'a', updatedAt: 'a', payload: {
      prompts: [{ identifier: 'same' }, { identifier: 'same' }], prompt_order: [],
    } };
    expect(() => validatePresetEdit(draft)).toThrow('标识');
  });

  it('edits and roundtrips the named real preset without losing extensions or order slots', async () => {
    const name = `preset-real-${crypto.randomUUID()}`;
    const db = await openMySillyDatabase(name);
    const payload = parseChatCompletionPresetJson(readFileSync('test-fixtures/【DarkSide-小猫之神】v2test.json', 'utf8'));
    const original: StoredPreset = { id: 'real', name: '真实预设', createdAt: 'a', updatedAt: 'a', payload };
    try {
      await savePreset(original, db);
      const draft = structuredClone(original);
      draft.payload.prompts[0].content = '测试编辑🌙';
      const saved = await savePresetEdit(original, draft, db);
      const reparsed = parseChatCompletionPresetJson(serializeChatCompletionPresetJson(saved.payload));
      expect(reparsed).toEqual(draft.payload);
      expect(reparsed.extensions).toEqual(payload.extensions);
      expect(reparsed.prompt_order).toEqual(payload.prompt_order);
    } finally { db.close(); await deleteDB(name); }
  });
  it('preserves unknown fields and rejects stale saves', async () => {
    const name = `preset-edit-${crypto.randomUUID()}`;
    const db = await openMySillyDatabase(name);
    const original: StoredPreset = { id: 'p', name: '原预设', createdAt: 'a', updatedAt: 'a', payload: {
      prompts: [{ identifier: 'main', content: 'original', custom: { keep: true } }],
      prompt_order: [{ character_id: 100001, order: [{ identifier: 'main', enabled: true, keep: 1 }] }],
      extensions: { tavern_helper: { untouched: true }, regex_scripts: [] }, unknown: ['keep'],
    }};
    try {
      await savePreset(original, db);
      const draft = structuredClone(original);
      draft.payload.prompts[0].content = 'edited';
      const result = await savePresetEdit(original, draft, db);
      expect(result.payload).toEqual(draft.payload);
      expect(original.payload.prompts[0].content).toBe('original');
      await expect(savePresetEdit(original, draft, db)).rejects.toThrow('已被修改');
      expect((await getPreset('p', db))?.payload.extensions).toEqual(original.payload.extensions);
      const invalid = structuredClone(result); invalid.payload.temperature = NaN;
      await expect(savePresetEdit(result, invalid, db)).rejects.toThrow('有限数值');
    } finally { db.close(); await deleteDB(name); }
  });
});
