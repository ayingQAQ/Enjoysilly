import type { PreserveUnknownFields, UnknownRecord } from "./common";

export type PortableWorldInfoPosition = "before_char" | "after_char";

export const nativeWorldInfoPositions = {
  before: 0,
  after: 1,
  ANTop: 2,
  ANBottom: 3,
  atDepth: 4,
  EMTop: 5,
  EMBottom: 6,
  outlet: 7,
} as const;

export type NativeWorldInfoPosition =
  (typeof nativeWorldInfoPositions)[keyof typeof nativeWorldInfoPositions];

export interface PortableWorldInfoEntry extends PreserveUnknownFields {
  keys: string[];
  secondary_keys?: string[];
  content: string;
  comment?: string;
  constant?: boolean;
  selective?: boolean;
  insertion_order?: number;
  enabled?: boolean;
  position?: PortableWorldInfoPosition;
  case_sensitive?: boolean;
  name?: string;
  priority?: number;
  id?: number;
  display_index?: number;
  extensions?: UnknownRecord;
}

export interface PortableCharacterBook extends PreserveUnknownFields {
  name?: string;
  entries: PortableWorldInfoEntry[];
}

export interface NativeWorldInfoEntry extends PreserveUnknownFields {
  uid?: number;
  key: string[];
  keysecondary?: string[];
  comment?: string;
  content: string;
  constant?: boolean;
  vectorized?: boolean;
  selective?: boolean;
  selectiveLogic?: number;
  addMemo?: boolean;
  order?: number;
  position?: NativeWorldInfoPosition;
  disable?: boolean;
  excludeRecursion?: boolean;
  preventRecursion?: boolean;
  delayUntilRecursion?: boolean;
  probability?: number;
  useProbability?: boolean;
  depth?: number;
  group?: string;
  groupOverride?: boolean;
  groupWeight?: number;
  scanDepth?: number | null;
  caseSensitive?: boolean | null;
  matchWholeWords?: boolean | null;
  useGroupScoring?: boolean | null;
  automationId?: string;
  role?: number | null;
  sticky?: number;
  cooldown?: number;
  delay?: number;
  displayIndex?: number;
  characterFilter?: {
    isExclude?: boolean;
    names?: string[];
    tags?: string[];
  };
  world?: string;
}

export interface NativeWorldInfoBook extends PreserveUnknownFields {
  entries: Record<string, NativeWorldInfoEntry>;
}
