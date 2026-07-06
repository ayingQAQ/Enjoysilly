import type { GroupConfig, GroupMember } from "../types/group";

export function normalizeGroupMembers(
  members: GroupMember[],
): GroupMember[] {
  return [...members]
    .map((m, i) => ({
      ...m,
      order: typeof m.order === "number" ? m.order : i,
    }))
    .filter((m) => m.enabled !== false)
    .sort((a, b) => a.order - b.order);
}

export function resolveNextGroupSpeaker(
  config: GroupConfig,
  lastSpeakerCharacterId?: string,
): string | undefined {
  const active = normalizeGroupMembers(config.members);

  if (active.length === 0) return undefined;

  if (config.speakerStrategy === "manual") {
    return config.nextSpeakerCharacterId ?? active[0].characterId;
  }

  if (config.speakerStrategy === "naturalRotation" && !lastSpeakerCharacterId) {
    return config.nextSpeakerCharacterId ?? active[0].characterId;
  }

  const lastIdx = active.findIndex(
    (m) => m.characterId === lastSpeakerCharacterId,
  );

  const nextIdx = lastIdx < 0 ? 0 : (lastIdx + 1) % active.length;

  return active[nextIdx].characterId;
}

export function getGroupMemberDisplayName(
  member: GroupMember,
  fallbackCharacterId?: string,
): string {
  return member.displayName ?? fallbackCharacterId ?? member.characterId;
}

export function createDefaultGroupConfig(name: string): GroupConfig {
  return {
    name,
    members: [],
    speakerStrategy: "listOrder",
  };
}
