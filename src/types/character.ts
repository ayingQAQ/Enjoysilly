import type { PreserveUnknownFields, UnknownRecord } from "./common";
import type { PortableCharacterBook } from "./worldinfo";

export type CharacterCardSpec = "chara_card_v2" | "chara_card_v3";

export interface CharacterCardDataV2 extends PreserveUnknownFields {
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  character_book?: PortableCharacterBook;
  tags?: string[];
  creator?: string;
  character_version?: string;
  extensions?: UnknownRecord;
}

export interface CharacterCardDataV3 extends CharacterCardDataV2 {
  assets?: UnknownRecord[];
  nickname?: string;
  creator_notes_multilingual?: Record<string, string>;
  source?: string[];
  group_only_greetings?: string[];
  creation_date?: number;
  modification_date?: number;
}

export type CharacterCardData = CharacterCardDataV2 | CharacterCardDataV3;

export interface CharacterCardV2 extends PreserveUnknownFields {
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: CharacterCardDataV2;
}

export interface CharacterCardV3 extends PreserveUnknownFields {
  spec: "chara_card_v3";
  spec_version: "3.0";
  data: CharacterCardDataV3;
}

export type CharacterCard = CharacterCardV2 | CharacterCardV3;
