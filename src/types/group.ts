import type { PreserveUnknownFields } from "./common";

export type SpeakerStrategy = "listOrder" | "naturalRotation" | "manual";

export interface GroupMember extends PreserveUnknownFields {
  characterId: string;
  displayName?: string;
  enabled: boolean;
  order: number;
}

export interface GroupConfig extends PreserveUnknownFields {
  name: string;
  members: GroupMember[];
  speakerStrategy: SpeakerStrategy;
  nextSpeakerCharacterId?: string;
  allowAutoReply?: boolean;
}
