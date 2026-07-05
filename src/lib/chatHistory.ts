import type { ChatMessageLine } from "../types/chat";
import type { ScannedWorldInfoEntry } from "./worldInfoScan";

export interface ChatHistoryBuildOptions {
  maxMessages?: number;
  includeSystemMessages?: boolean;
  atDepthEntries?: ScannedWorldInfoEntry[];
}

export interface ChatHistorySegment {
  kind: "message" | "worldInfo";
  content: string;
  name?: string;
  sourceIndex?: number;
  worldInfo?: ScannedWorldInfoEntry;
}

export function buildChatHistorySegments(
  messages: ChatMessageLine[],
  options: ChatHistoryBuildOptions = {},
): ChatHistorySegment[] {
  const selectedMessages = selectRecentMessages(messages, options.maxMessages);
  const messageSegments = selectedMessages
    .map(({ message, sourceIndex }) =>
      createMessageSegment(message, sourceIndex, options),
    )
    .filter((segment): segment is ChatHistorySegment => Boolean(segment));

  return insertAtDepthSegments(
    messageSegments,
    options.atDepthEntries ?? [],
  );
}

export function buildChatHistoryText(
  messages: ChatMessageLine[],
  options: ChatHistoryBuildOptions = {},
): string {
  return buildChatHistorySegments(messages, options)
    .map(formatChatHistorySegment)
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

export function getChatMessageDisplayText(message: ChatMessageLine): string {
  const swipeIndex =
    typeof message.swipe_id === "number" && Number.isInteger(message.swipe_id)
      ? message.swipe_id
      : undefined;

  if (
    Array.isArray(message.swipes) &&
    swipeIndex !== undefined &&
    swipeIndex >= 0 &&
    swipeIndex < message.swipes.length &&
    typeof message.swipes[swipeIndex] === "string"
  ) {
    return message.swipes[swipeIndex];
  }

  return message.mes;
}

function selectRecentMessages(
  messages: ChatMessageLine[],
  maxMessages: number | undefined,
): Array<{ message: ChatMessageLine; sourceIndex: number }> {
  const normalizedMax =
    typeof maxMessages === "number" && Number.isFinite(maxMessages)
      ? Math.max(0, Math.floor(maxMessages))
      : messages.length;
  const startIndex = Math.max(0, messages.length - normalizedMax);

  return messages.slice(startIndex).map((message, index) => ({
    message,
    sourceIndex: startIndex + index,
  }));
}

function createMessageSegment(
  message: ChatMessageLine,
  sourceIndex: number,
  options: ChatHistoryBuildOptions,
): ChatHistorySegment | undefined {
  if (message.is_system === true && options.includeSystemMessages !== true) {
    return undefined;
  }

  const content = getChatMessageDisplayText(message).trim();

  if (content.length === 0) {
    return undefined;
  }

  return {
    kind: "message",
    name: message.name,
    content,
    sourceIndex,
  };
}

function insertAtDepthSegments(
  messageSegments: ChatHistorySegment[],
  atDepthEntries: ScannedWorldInfoEntry[],
): ChatHistorySegment[] {
  if (atDepthEntries.length === 0) {
    return messageSegments;
  }

  const result = [...messageSegments];
  const sortedEntries = [...atDepthEntries].sort(compareAtDepthEntries);

  for (const entry of sortedEntries) {
    const content = entry.content.trim();

    if (content.length === 0) {
      continue;
    }

    result.splice(resolveAtDepthIndex(result, entry.depth), 0, {
      kind: "worldInfo",
      content,
      worldInfo: entry,
    });
  }

  return result;
}

function resolveAtDepthIndex(
  segments: ChatHistorySegment[],
  depth: number | undefined,
): number {
  const normalizedDepth =
    typeof depth === "number" && Number.isFinite(depth)
      ? Math.max(0, Math.floor(depth))
      : 0;

  return Math.max(0, segments.length - normalizedDepth);
}

function compareAtDepthEntries(
  left: ScannedWorldInfoEntry,
  right: ScannedWorldInfoEntry,
): number {
  return (
    numberOrZero(right.depth) - numberOrZero(left.depth) ||
    left.order - right.order ||
    left.sourceIndex - right.sourceIndex
  );
}

function formatChatHistorySegment(segment: ChatHistorySegment): string {
  if (segment.kind === "worldInfo") {
    return segment.content;
  }

  return `${segment.name}: ${segment.content}`;
}

function numberOrZero(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
