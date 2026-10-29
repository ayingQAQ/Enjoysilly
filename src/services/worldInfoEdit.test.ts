import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import {
  getCharacter,
  getWorldInfo,
  openMySillyDatabase,
  saveCharacter,
  saveWorldInfo,
  type StoredWorldInfo,
} from "../lib/db";
import { decodeCharacterCardFromPng } from "../lib/png";
import { createCharacterPngExport } from "./characterExport";
import { importCharacterToDatabase } from "./characterImport";
import {
  applyWorldInfoEditDraft,
  createNewWorldInfoEntryDraft,
  createWorldInfoEditDraft,
  updateWorldInfoFromDraft,
  validateWorldInfoEditDraft,
} from "./worldInfoEdit";

const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_world_edit_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("world info edit service", () => {
  it("rejects stale entry positions after another editor reorders a portable book", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    try {
      const original: StoredWorldInfo = { id: "conflict", name: "book", createdAt: "a", updatedAt: "a", payload: {
        entries: [{ keys: ["a"], content: "A", enabled: true, insertion_order: 1 },
          { keys: ["b"], content: "B", enabled: true, insertion_order: 2 }],
      } };
      await saveWorldInfo(original, database);
      const stale = createWorldInfoEditDraft(original);
      const newer = createWorldInfoEditDraft(original); newer.entries.reverse();
      await updateWorldInfoFromDraft(original.id, newer, { database });
      stale.entries[0].content = "wrong position";
      await expect(updateWorldInfoFromDraft(original.id, stale, { database })).rejects.toThrow("已被修改");
      const stored = await getWorldInfo(original.id, database);
      expect(Array.isArray(stored?.payload.entries) && stored.payload.entries[0].content).toBe("B");
    } finally { database.close(); }
  });
  it("updates a native entry without materializing untouched fields", () => {
    const stored: StoredWorldInfo = {
      id: "native-world",
      name: "Native world",
      createdAt: "2026-08-12T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
      payload: {
        root_unknown: { keep: true },
        entries: {
          "7": {
            uid: 7,
            key: [" keep spaces ", "duplicate", "duplicate"],
            content: "Original content",
            order: 17,
            custom_entry_field: "keep",
          },
        },
      },
    };
    const original = structuredClone(stored);
    const draft = createWorldInfoEditDraft(stored);

    draft.entries[0].content = "Updated content";
    const updated = applyWorldInfoEditDraft(
      stored,
      draft,
      () => "2026-08-12T01:00:00.000Z",
    );
    const entry = "key" in updated.payload.entries
      ? undefined
      : updated.payload.entries["7"];

    expect(stored).toEqual(original);
    expect(entry?.content).toBe("Updated content");
    expect(entry?.key).toEqual([" keep spaces ", "duplicate", "duplicate"]);
    expect(entry).toHaveProperty("custom_entry_field", "keep");
    expect(entry).not.toHaveProperty("constant");
    expect(updated.payload).toHaveProperty("root_unknown", { keep: true });
    expect(updated.updatedAt).toBe("2026-08-12T01:00:00.000Z");
  });

  it("preserves portable names and extensions while writing mapped fields", () => {
    const stored: StoredWorldInfo = {
      id: "character-1__character_book",
      name: "Character · 内嵌世界书",
      createdAt: "2026-08-12T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
      payload: {
        name: "Original embedded name",
        root_unknown: "keep",
        entries: [
          {
            id: 3,
            keys: ["old"],
            content: "content",
            position: "before_char",
            display_index: 9,
            extensions: {
              probability: 80,
              useProbability: true,
              custom_extension: "keep",
            },
            custom_entry_field: "keep",
          },
        ],
      },
    };
    const draft = createWorldInfoEditDraft(stored);

    draft.entries[0].keys = [" new ", "new", "second"];
    draft.entries[0].probability = 65;
    const updated = applyWorldInfoEditDraft(stored, draft);

    expect(updated.payload.name).toBe("Original embedded name");
    expect(updated.payload.entries).toHaveLength(1);
    const entry = updated.payload.entries[0];
    expect(entry.keys).toEqual(["new", "second"]);
    expect(entry.display_index).toBe(9);
    expect(entry).toHaveProperty("custom_entry_field", "keep");
    expect(entry.extensions).toEqual({
      probability: 65,
      useProbability: true,
      custom_extension: "keep",
    });
  });

  it("adds, deletes and explicitly reorders native entries", () => {
    const stored: StoredWorldInfo = {
      id: "reorder-world",
      name: "Reorder world",
      createdAt: "2026-08-12T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
      payload: {
        entries: {
          "0": { uid: 0, key: ["a"], content: "A", order: 10 },
          "1": { uid: 1, key: ["b"], content: "B", order: 20 },
          "2": { uid: 2, key: ["c"], content: "C", order: 30 },
        },
      },
    };
    const draft = createWorldInfoEditDraft(stored);
    const newEntry = createNewWorldInfoEntryDraft("native");
    newEntry.content = "D";
    newEntry.keys = ["d"];

    draft.entries = [draft.entries[2], draft.entries[0], newEntry];
    const updated = applyWorldInfoEditDraft(stored, draft);

    expect(Object.keys(updated.payload.entries)).toEqual(["0", "2", "3"]);
    expect(updated.payload.entries["2"].order).toBe(100);
    expect(updated.payload.entries["0"].order).toBe(200);
    expect(updated.payload.entries["3"]).toMatchObject({
      uid: 3,
      key: ["d"],
      content: "D",
      order: 300,
    });
  });

  it("does not renumber surviving entries when only deleting or appending", () => {
    const stored: StoredWorldInfo = {
      id: "append-world",
      name: "Append world",
      createdAt: "2026-08-12T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
      payload: {
        entries: {
          "0": { uid: 0, key: ["a"], content: "A", order: 17 },
          "1": { uid: 1, key: ["b"], content: "B", order: 91 },
        },
      },
    };
    const draft = createWorldInfoEditDraft(stored);
    const newEntry = createNewWorldInfoEntryDraft("native");
    newEntry.content = "C";
    draft.entries = [draft.entries[0], newEntry];

    const updated = applyWorldInfoEditDraft(stored, draft);

    expect(updated.payload.entries["0"].order).toBe(17);
    expect(updated.payload.entries["2"].order).toBe(200);
  });

  it("validates names and probability ranges without rejecting empty content", () => {
    const stored: StoredWorldInfo = {
      id: "validate-world",
      name: "World",
      createdAt: "2026-08-12T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
      payload: { entries: { "0": { key: [], content: "content" } } },
    };
    const draft = createWorldInfoEditDraft(stored);
    draft.name = " ";
    draft.entries[0].content = "";
    draft.entries[0].probability = 101;

    const errors = validateWorldInfoEditDraft(draft);
    expect(errors.name).toBe("世界书名称不能为空。");
    expect(errors.entries[draft.entries[0].draftId]).toEqual({
      probability: "概率必须在 0–100 之间。",
    });
  });

  it("synchronizes an edited real embedded book back into its character PNG", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const fixtureBytes = new Uint8Array(
      readFileSync(join(process.cwd(), "test-fixtures", "红楼.png")),
    );

    try {
      const imported = await importCharacterToDatabase(
        fixtureBytes,
        "红楼.png",
        {
          database,
          id: "honglou-world-edit",
          now: () => "2026-08-12T02:00:00.000Z",
        },
      );
      const worldId = "honglou-world-edit__character_book";
      const storedWorld = await getWorldInfo(worldId, database);
      expect(storedWorld).toBeDefined();

      const originalBookName = imported.imported.card.data.character_book?.name;
      const originalAvatar = imported.imported.card.data.avatar;
      const draft = createWorldInfoEditDraft(storedWorld!);
      draft.entries[0].content = "编辑后的世界书内容";

      const result = await updateWorldInfoFromDraft(worldId, draft, {
        database,
        now: () => "2026-08-12T02:30:00.000Z",
      });
      const character = await getCharacter("honglou-world-edit", database);
      const exported = await createCharacterPngExport(
        "honglou-world-edit",
        database,
      );
      const decoded = decodeCharacterCardFromPng(exported.bytes);

      expect(result.syncedCharacterId).toBe("honglou-world-edit");
      expect(character?.payload.data.character_book?.entries[0].content).toBe(
        "编辑后的世界书内容",
      );
      expect(decoded.data.character_book?.name).toBe(originalBookName);
      expect(decoded.data.character_book?.entries[0]).toHaveProperty(
        "display_index",
      );
      expect(decoded.data.avatar).toBe(originalAvatar);
    } finally {
      database.close();
    }
  }, 15_000);

  it("converts a linked native world to portable form when synchronizing", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const now = "2026-08-12T03:00:00.000Z";

    try {
      await saveCharacter(
        {
          id: "native-linked",
          name: "Linked character",
          createdAt: now,
          updatedAt: now,
          payload: {
            spec: "chara_card_v2",
            spec_version: "2.0",
            root_unknown: "keep",
            data: {
              name: "Linked character",
              character_book: { name: "Old", entries: [] },
              extensions: { keep: true },
            },
          },
        },
        database,
      );
      await saveWorldInfo(
        {
          id: "native-linked__character_book",
          name: "Native linked world",
          createdAt: now,
          updatedAt: now,
          payload: {
            root_unknown: "keep-world",
            entries: {
              "4": {
                uid: 4,
                key: ["native"],
                content: "Native content",
                position: 4,
                probability: 70,
                useProbability: true,
                extensions: { custom_extension: "keep" },
                custom_entry_field: "keep",
              },
            },
          },
        },
        database,
      );

      const storedWorld = await getWorldInfo(
        "native-linked__character_book",
        database,
      );
      const draft = createWorldInfoEditDraft(storedWorld!);
      draft.entries[0].content = "Updated native content";

      await updateWorldInfoFromDraft(
        "native-linked__character_book",
        draft,
        { database },
      );

      const character = await getCharacter("native-linked", database);
      const embedded = character?.payload.data.character_book;
      expect(embedded?.entries[0]).toMatchObject({
        id: 4,
        keys: ["native"],
        content: "Updated native content",
        extensions: {
          probability: 70,
          useProbability: true,
          custom_extension: "keep",
        },
        custom_entry_field: "keep",
      });
      expect(character?.payload).toHaveProperty("root_unknown", "keep");
      expect(character?.payload.data.extensions).toEqual({ keep: true });
    } finally {
      database.close();
    }
  });
});
