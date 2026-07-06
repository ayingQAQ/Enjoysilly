import { describe, expect, it } from "vitest";

import {
  createDefaultGroupConfig,
  getGroupMemberDisplayName,
  normalizeGroupMembers,
  resolveNextGroupSpeaker,
} from "./groupSpeaker";
import type { GroupConfig, GroupMember } from "../types/group";

describe("groupSpeaker", () => {
  describe("normalizeGroupMembers", () => {
    it("filters disabled members and sorts by order", () => {
      const members: GroupMember[] = [
        { characterId: "c3", enabled: false, order: 0 },
        { characterId: "c1", enabled: true, order: 2 },
        { characterId: "c2", enabled: true, order: 1 },
      ];

      const result = normalizeGroupMembers(members);
      expect(result).toHaveLength(2);
      expect(result[0].characterId).toBe("c2");
      expect(result[1].characterId).toBe("c1");
    });

    it("assigns default order from index", () => {
      const members: GroupMember[] = [
        { characterId: "a", enabled: true, order: 0 as unknown as number },
        { characterId: "b", enabled: true, order: 0 as unknown as number },
      ];
      // Clear order to test default assignment
      members[0] = { ...members[0], order: undefined as unknown as number };
      members[1] = { ...members[1], order: undefined as unknown as number };

      const result = normalizeGroupMembers(members as GroupMember[]);
      expect(result[0].characterId).toBe("a");
      expect(result[1].characterId).toBe("b");
    });
  });

  describe("resolveNextGroupSpeaker", () => {
    it("returns first member for listOrder with no last speaker", () => {
      const config: GroupConfig = {
        name: "G",
        members: [
          { characterId: "c1", enabled: true, order: 0 },
          { characterId: "c2", enabled: true, order: 1 },
        ],
        speakerStrategy: "listOrder",
      };

      expect(resolveNextGroupSpeaker(config)).toBe("c1");
    });

    it("cycles through listOrder", () => {
      const config: GroupConfig = {
        name: "G",
        members: [
          { characterId: "c1", enabled: true, order: 0 },
          { characterId: "c2", enabled: true, order: 1 },
          { characterId: "c3", enabled: true, order: 2 },
        ],
        speakerStrategy: "listOrder",
      };

      expect(resolveNextGroupSpeaker(config, "c1")).toBe("c2");
      expect(resolveNextGroupSpeaker(config, "c2")).toBe("c3");
      expect(resolveNextGroupSpeaker(config, "c3")).toBe("c1");
    });

    it("skips disabled members", () => {
      const config: GroupConfig = {
        name: "G",
        members: [
          { characterId: "c1", enabled: false, order: 0 },
          { characterId: "c2", enabled: true, order: 1 },
        ],
        speakerStrategy: "listOrder",
      };

      expect(resolveNextGroupSpeaker(config)).toBe("c2");
    });

    it("uses nextSpeakerCharacterId for manual strategy", () => {
      const config: GroupConfig = {
        name: "G",
        members: [
          { characterId: "c1", enabled: true, order: 0 },
          { characterId: "c2", enabled: true, order: 1 },
        ],
        speakerStrategy: "manual",
        nextSpeakerCharacterId: "c2",
      };

      expect(resolveNextGroupSpeaker(config)).toBe("c2");
    });

    it("falls back to first member when manual has no explicit next", () => {
      const config: GroupConfig = {
        name: "G",
        members: [
          { characterId: "c1", enabled: true, order: 0 },
        ],
        speakerStrategy: "manual",
      };

      expect(resolveNextGroupSpeaker(config)).toBe("c1");
    });

    it("returns undefined for empty members", () => {
      const config: GroupConfig = {
        name: "G",
        members: [],
        speakerStrategy: "listOrder",
      };

      expect(resolveNextGroupSpeaker(config)).toBeUndefined();
    });
  });

  describe("getGroupMemberDisplayName", () => {
    it("prefers displayName over characterId", () => {
      const m: GroupMember = {
        characterId: "char-1",
        displayName: "Alice",
        enabled: true,
        order: 0,
      };

      expect(getGroupMemberDisplayName(m)).toBe("Alice");
    });

    it("falls back to characterId", () => {
      const m: GroupMember = {
        characterId: "char-1",
        enabled: true,
        order: 0,
      };

      expect(getGroupMemberDisplayName(m)).toBe("char-1");
    });
  });

  describe("createDefaultGroupConfig", () => {
    it("creates a config with listOrder strategy and empty members", () => {
      const config = createDefaultGroupConfig("New Group");
      expect(config.name).toBe("New Group");
      expect(config.speakerStrategy).toBe("listOrder");
      expect(config.members).toEqual([]);
    });
  });
});
