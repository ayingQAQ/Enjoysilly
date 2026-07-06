import {
  createStoredEntity,
} from "./entityMetadata";
import {
  deleteGroup,
  getGroup,
  listGroups,
  saveGroup,
  type MySillyDatabaseConnection,
  type StoredGroup,
} from "../lib/db";
import type { CharacterAssetSummary } from "./assetCatalog";
import type { GroupConfig, GroupMember } from "../types/group";
import { normalizeGroupMembers } from "../lib/groupSpeaker";

export interface GroupAssetSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  enabledMemberCount: number;
  speakerStrategy: string;
  sampleMemberNames: string[];
}

export interface GroupDetail {
  stored: StoredGroup;
  summary: GroupAssetSummary;
}

export async function loadGroupAssetSummaries(
  database?: MySillyDatabaseConnection,
): Promise<GroupAssetSummary[]> {
  const groups = await listGroups(database);

  return groups
    .map(createGroupAssetSummary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadGroupDetail(
  id: string,
  database?: MySillyDatabaseConnection,
): Promise<GroupDetail | undefined> {
  const stored = await getGroup(id, database);

  if (!stored) return undefined;

  return {
    stored,
    summary: createGroupAssetSummary(stored),
  };
}

export function createGroupAssetSummary(stored: StoredGroup): GroupAssetSummary {
  const members = normalizeGroupMembers(stored.payload.members);

  return {
    id: stored.id,
    name: stored.name,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    memberCount: stored.payload.members.length,
    enabledMemberCount: members.length,
    speakerStrategy: stored.payload.speakerStrategy,
    sampleMemberNames: members.slice(0, 3).map(
      (m) => m.displayName ?? m.characterId,
    ),
  };
}

export function createStoredGroup(
  config: GroupConfig,
  name: string,
): StoredGroup {
  return createStoredEntity<GroupConfig>(config, name, "group_") as StoredGroup;
}

export async function createGroup(
  name: string,
  members: GroupMember[],
  options: {
    speakerStrategy?: GroupConfig["speakerStrategy"];
    database?: MySillyDatabaseConnection;
  } = {},
): Promise<StoredGroup> {
  const config: GroupConfig = {
    name,
    members: members.map((m, i) => ({
      ...m,
      order: typeof m.order === "number" ? m.order : i,
    })),
    speakerStrategy: options.speakerStrategy ?? "listOrder",
  };
  const stored = createStoredGroup(config, name);

  await saveGroup(stored, options.database);

  return stored;
}

export async function updateGroupMemberList(
  groupId: string,
  members: GroupMember[],
  options: { database?: MySillyDatabaseConnection } = {},
): Promise<StoredGroup> {
  const stored = await getGroup(groupId, options.database);

  if (!stored) {
    throw new Error(`Group ${groupId} not found.`);
  }

  const updated: StoredGroup = {
    ...stored,
    updatedAt: new Date().toISOString(),
    payload: {
      ...stored.payload,
      members: members.map((m, i) => ({
        ...m,
        order: m.order ?? i,
      })),
    },
  };

  await saveGroup(updated, options.database);

  return updated;
}

export async function removeGroup(
  id: string,
  options: { database?: MySillyDatabaseConnection } = {},
): Promise<void> {
  const exists = await getGroup(id, options.database);

  if (!exists) {
    throw new Error(`Group ${id} not found.`);
  }

  await deleteGroup(id, options.database);
}
