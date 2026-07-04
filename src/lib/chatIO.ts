import type {
  ChatMessageLine,
  ChatMetadataLine,
  SillyTavernChatLog,
} from "../types/chat";

export class ChatJsonlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatJsonlError";
  }
}

export function parseSillyTavernChatJsonl(jsonl: string): SillyTavernChatLog {
  const lines = jsonl
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new ChatJsonlError("Chat JSONL is empty.");
  }

  const metadata = parseJsonLine(lines[0], 1);

  if (!isRecord(metadata)) {
    throw new ChatJsonlError("Chat metadata line must be an object.");
  }

  const messages = lines.slice(1).map((line, index) => {
    const value = parseJsonLine(line, index + 2);

    if (!isChatMessageLine(value)) {
      throw new ChatJsonlError(`Chat message line ${index + 2} is invalid.`);
    }

    return value;
  });

  return {
    metadata: metadata as ChatMetadataLine,
    messages,
  };
}

export function serializeSillyTavernChatJsonl(
  chatLog: SillyTavernChatLog,
): string {
  return [
    JSON.stringify(chatLog.metadata),
    ...chatLog.messages.map((message) => JSON.stringify(message)),
  ].join("\n");
}

export function encodeSillyTavernChatJsonl(
  chatLog: SillyTavernChatLog,
): Uint8Array {
  return new TextEncoder().encode(serializeSillyTavernChatJsonl(chatLog));
}

function parseJsonLine(line: string, lineNumber: number): unknown {
  try {
    return JSON.parse(line) as unknown;
  } catch (error) {
    throw new ChatJsonlError(
      `Chat JSONL line ${lineNumber} is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function isChatMessageLine(value: unknown): value is ChatMessageLine {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.name === "string" && typeof value.mes === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
