import { encodeSillyTavernChatJsonl } from "../lib/chatIO";
import { formatSillyTavernChatDate } from "../lib/chatTurn";
import type { ChatMessageLine, SillyTavernChatLog } from "../types/chat";
import { createChatLogSnapshot } from "./chatPersistence";
import { createSafeFileName } from "./exportFileName";

export interface CreateChatExportInput {
  messages: ChatMessageLine[];
  userName: string;
  characterName: string;
  chatName?: string;
  now?: Date;
}

export interface ChatExportArtifact {
  fileName: string;
  bytes: Uint8Array;
  chatLog: SillyTavernChatLog;
}

export function createChatJsonlExport(
  input: CreateChatExportInput,
): ChatExportArtifact {
  const now = input.now ?? new Date();
  const chatLog = createChatLogSnapshot({
    messages: input.messages,
    userName: input.userName,
    characterName: input.characterName,
    now,
  });

  return {
    fileName: createChatJsonlFileName({
      chatName: input.chatName,
      characterName: input.characterName,
      now,
    }),
    bytes: encodeSillyTavernChatJsonl(chatLog),
    chatLog,
  };
}

export function createChatJsonlFileName(input: {
  chatName?: string;
  characterName?: string;
  now?: Date;
}): string {
  const timestamp = formatSillyTavernChatDate(input.now).replace("@", " ");
  const baseName = firstNonEmptyText(
    input.chatName,
    input.characterName ? `${input.characterName} ${timestamp}` : undefined,
    timestamp,
  );

  return createSafeFileName(baseName, "chat", "jsonl");
}

function firstNonEmptyText(...values: Array<string | undefined>): string {
  return values.find((value) => value && value.trim().length > 0)?.trim() ?? "";
}
