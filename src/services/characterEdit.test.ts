import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import { decodeCharacterCardFromPng } from "../lib/png";
import { getCharacter, openMySillyDatabase } from "../lib/db";
import { createCharacterPngExport } from "./characterExport";
import { importCharacterToDatabase } from "./characterImport";
import {
  applyCharacterEditDraft,
  createCharacterEditDraft,
  updateCharacterFromDraft,
  validateCharacterAvatarPng,
  validateCharacterEditDraft,
} from "./characterEdit";

const testDatabaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(testDatabaseNames.splice(0).map((name) => deleteDB(name)));
});

function createTestDatabaseName(): string {
  const name = `my_silly_character_edit_${crypto.randomUUID()}`;
  testDatabaseNames.push(name);
  return name;
}

describe("character edit service", () => {
  it("rejects a stale draft instead of overwriting another editor's changes", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    try {
      const original = { id: "conflict", name: "Original", createdAt: "a", updatedAt: "a", payload: {
        spec: "chara_card_v2" as const, spec_version: "2.0" as const, data: { name: "Original", description: "old" },
      } };
      await database.put("characters", original);
      const stale = createCharacterEditDraft(original);
      const newer = createCharacterEditDraft(original); newer.description = "new";
      await updateCharacterFromDraft(original.id, newer, { database });
      stale.name = "rename";
      await expect(updateCharacterFromDraft(original.id, stale, { database })).rejects.toThrow("已被修改");
      expect((await getCharacter(original.id, database))?.payload.data.description).toBe("new");
    } finally { database.close(); }
  });
  it("creates an isolated draft and validates the required name", () => {
    const stored = {
      id: "character-1",
      name: "Original",
      createdAt: "2026-08-12T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
      payload: {
        spec: "chara_card_v2" as const,
        spec_version: "2.0" as const,
        data: {
          name: "Original",
          tags: ["one"],
          alternate_greetings: ["Hello"],
        },
      },
    };

    const draft = createCharacterEditDraft(stored);
    draft.tags.push("two");
    draft.alternateGreetings[0] = "Changed";

    expect(stored.payload.data.tags).toEqual(["one"]);
    expect(stored.payload.data.alternate_greetings).toEqual(["Hello"]);
    expect(validateCharacterEditDraft({ ...draft, name: "  " })).toEqual({
      name: "角色名称不能为空。",
    });
  });

  it("updates editable fields without mutating or losing compatibility fields", () => {
    const sourcePngBytes = Uint8Array.from([1, 2, 3]);
    const stored = {
      id: "character-2",
      name: "Original",
      createdAt: "2026-08-12T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
      sourceFileName: "original.png",
      sourcePngBytes,
      payload: {
        spec: "chara_card_v3" as const,
        spec_version: "3.0" as const,
        root_unknown: { keep: true },
        data: {
          name: "Original",
          avatar: "avatar.png",
          extensions: { plugin: { enabled: true } },
          character_book: {
            name: "Book",
            entries: [
              {
                keys: ["key"],
                content: "content",
                enabled: true,
                insertion_order: 100,
                display_index: 7,
              },
            ],
          },
        },
      },
    };
    const originalSnapshot = structuredClone(stored);
    const draft = createCharacterEditDraft(stored);

    Object.assign(draft, {
      name: "  Edited  ",
      description: "New description",
      nickname: "Nick",
      tags: [" fantasy ", "fantasy", ""],
      alternateGreetings: [" Welcome ", "Welcome", "Second"],
      groupOnlyGreetings: [" Group hello "],
    });

    const updated = applyCharacterEditDraft(
      stored,
      draft,
      () => "2026-08-12T01:00:00.000Z",
    );

    expect(stored).toEqual(originalSnapshot);
    expect(updated.name).toBe("Edited");
    expect(updated.updatedAt).toBe("2026-08-12T01:00:00.000Z");
    expect(updated.payload.data.name).toBe("Edited");
    expect(updated.payload.data.description).toBe("New description");
    expect(updated.payload.data.tags).toEqual(["fantasy"]);
    expect(updated.payload.data.alternate_greetings).toEqual([
      " Welcome ",
      "Welcome",
      "Second",
    ]);
    expect(updated.payload.data.nickname).toBe("Nick");
    expect(updated.payload.data.group_only_greetings).toEqual([
      " Group hello ",
    ]);
    expect(updated.payload.root_unknown).toEqual({ keep: true });
    expect(updated.payload.data.avatar).toBe("avatar.png");
    expect(updated.payload.data.extensions).toEqual({
      plugin: { enabled: true },
    });
    expect(updated.payload.data.character_book?.entries[0]).toHaveProperty(
      "display_index",
      7,
    );
    expect(updated.payload.data).not.toHaveProperty("personality");
    expect(updated.payload.data).not.toHaveProperty("creator");
    expect(updated.sourcePngBytes).toEqual(sourcePngBytes);
    expect(updated.sourcePngBytes).not.toBe(sourcePngBytes);
  });

  it("does not materialize or normalize untouched optional fields", () => {
    const stored = {
      id: "character-minimal",
      name: "Original",
      createdAt: "2026-08-12T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
      payload: {
        spec: "chara_card_v2" as const,
        spec_version: "2.0" as const,
        data: {
          name: "Original",
          tags: [" keep spaces ", "duplicate", "duplicate"],
          alternate_greetings: ["  Keep greeting whitespace  "],
        },
      },
    };
    const draft = createCharacterEditDraft(stored);

    draft.name = "Renamed";
    const updated = applyCharacterEditDraft(stored, draft);

    expect(updated.payload.data.tags).toEqual(stored.payload.data.tags);
    expect(updated.payload.data.alternate_greetings).toEqual(
      stored.payload.data.alternate_greetings,
    );
    expect(updated.payload.data).not.toHaveProperty("description");
    expect(updated.payload.data).not.toHaveProperty("group_only_greetings");
  });

  it("persists edits and exports a real PNG fixture without field loss", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const fixturePath = join(process.cwd(), "test-fixtures", "红楼.png");

    try {
      const imported = await importCharacterToDatabase(
        readFileSync(fixturePath),
        "红楼.png",
        {
          database,
          id: "honglou-edit",
          now: () => "2026-08-12T02:00:00.000Z",
        },
      );
      const draft = createCharacterEditDraft(imported.stored);
      const originalAvatar = imported.imported.card.data.avatar;
      const originalBook = structuredClone(
        imported.imported.card.data.character_book,
      );

      draft.name = "红楼编辑测试";
      draft.description = "编辑后的描述";
      draft.tags = [...draft.tags, "回归测试"];

      await updateCharacterFromDraft("honglou-edit", draft, {
        database,
        now: () => "2026-08-12T02:30:00.000Z",
      });

      const persisted = await getCharacter("honglou-edit", database);
      const exported = await createCharacterPngExport("honglou-edit", database);
      const decoded = decodeCharacterCardFromPng(exported.bytes);

      expect(persisted?.name).toBe("红楼编辑测试");
      expect(decoded.data.name).toBe("红楼编辑测试");
      expect(decoded.data.description).toBe("编辑后的描述");
      expect(decoded.data.tags).toContain("回归测试");
      expect(decoded.data.avatar).toBe(originalAvatar);
      expect(decoded.data.character_book).toEqual(originalBook);
      expect(decoded.data.character_book?.entries[0]).toHaveProperty(
        "display_index",
      );
    } finally {
      database.close();
    }
  });

  it("reports a missing character clearly", async () => {
    const database = await openMySillyDatabase(createTestDatabaseName());
    const draft = createCharacterEditDraft({
      id: "draft",
      name: "Draft",
      createdAt: "2026-08-12T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
      payload: {
        spec: "chara_card_v2",
        spec_version: "2.0",
        data: { name: "Draft" },
      },
    });

    await expect(
      updateCharacterFromDraft("missing", draft, { database }),
    ).rejects.toThrow("Character card not found: missing");

    database.close();
  });

  it("rejects unsafe avatar inputs and persists a valid replacement PNG", async () => {
    expect(() => validateCharacterAvatarPng(Uint8Array.from([1, 2, 3]))).toThrow(
      "请选择有效的 PNG 图片。",
    );

    const database = await openMySillyDatabase(createTestDatabaseName());
    const fixtureBytes = new Uint8Array(
      readFileSync(join(process.cwd(), "test-fixtures", "红楼.png")),
    );
    expect(() => validateCharacterAvatarPng(fixtureBytes.slice(0, 24))).toThrow(
      "PNG 文件结构不完整或已损坏。",
    );

    try {
      const imported = await importCharacterToDatabase(
        fixtureBytes,
        "old.png",
        { database, id: "avatar-edit" },
      );
      const draft = createCharacterEditDraft(imported.stored);

      await updateCharacterFromDraft("avatar-edit", draft, {
        database,
        avatarReplacement: {
          bytes: fixtureBytes,
          fileName: "new-avatar.png",
        },
      });

      const persisted = await getCharacter("avatar-edit", database);
      expect(persisted?.sourceFileName).toBe("new-avatar.png");
      expect(persisted?.sourcePngBytes).toEqual(fixtureBytes);
    } finally {
      database.close();
    }
  }, 15_000);
});
