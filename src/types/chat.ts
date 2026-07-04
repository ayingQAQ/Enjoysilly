import type { PreserveUnknownFields, UnknownRecord } from "./common";

export interface ChatMetadataLine extends PreserveUnknownFields {
  user_name?: string;
  character_name?: string;
  create_date?: string;
  chat_metadata?: UnknownRecord;
}

export interface ChatMessageLine extends PreserveUnknownFields {
  name: string;
  is_user?: boolean;
  is_system?: boolean;
  send_date?: string;
  mes: string;
  extra?: UnknownRecord;
  swipe_id?: number;
  swipes?: string[];
  swipe_info?: UnknownRecord[];
}

export interface SillyTavernChatLog {
  metadata: ChatMetadataLine;
  messages: ChatMessageLine[];
}
