import type { RegexScriptLike } from "../../lib/regexEngine";
import type { ChatMessageLine } from "../../types/chat";
import { EmptyChatState } from "../ChatScreenPanels";
import { ChatBubble, type ChatHtmlCardAction } from "./ChatMessageBubble";

interface ChatMessageListProps {
  disabled: boolean;
  displayRegexScripts: RegexScriptLike[];
  messages: ChatMessageLine[];
  onDelete: (messageIndex: number) => void;
  onEdit: (messageIndex: number) => void;
  onHtmlCardAction: (action: ChatHtmlCardAction) => void;
  onReroll: (messageIndex: number) => void;
  onSwipe: (messageIndex: number, direction: -1 | 1) => void;
}

export function ChatMessageList({
  disabled,
  displayRegexScripts,
  messages,
  onDelete,
  onEdit,
  onHtmlCardAction,
  onReroll,
  onSwipe,
}: ChatMessageListProps) {
  if (messages.length === 0) {
    return <EmptyChatState />;
  }

  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <ChatBubble
          key={`${message.name}-${index}`}
          disabled={disabled}
          displayRegexScripts={displayRegexScripts}
          message={message}
          onDelete={() => onDelete(index)}
          onEdit={() => onEdit(index)}
          onHtmlCardAction={onHtmlCardAction}
          onReroll={() => onReroll(index)}
          onSwipeNext={() => onSwipe(index, 1)}
          onSwipePrevious={() => onSwipe(index, -1)}
        />
      ))}
    </div>
  );
}
