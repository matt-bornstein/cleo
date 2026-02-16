import { MessageBubble } from "@/components/ai/MessageBubble";
import { hasControlChars } from "@/lib/validators/controlChars";

type ChatMessagesProps = {
  messages: unknown;
};

export function ChatMessages({ messages }: ChatMessagesProps) {
  const normalizedMessages = Array.isArray(messages)
    ? messages.flatMap((message, index) => {
        if (!message || typeof message !== "object") {
          return [];
        }

        const normalizedId = normalizeMessageEntryId(message, index);
        return [{ id: normalizedId, message }];
      })
    : [];

  if (normalizedMessages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
        Ask the assistant to rewrite, summarize, or edit your document.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {normalizedMessages.map((entry) => (
        <MessageBubble key={entry.id} message={entry.message} />
      ))}
    </div>
  );
}

function normalizeMessageEntryId(message: unknown, index: number) {
  if (!message || typeof message !== "object") {
    return `message-${index}`;
  }

  let messageId: unknown;
  try {
    messageId = (message as { id?: unknown }).id;
  } catch {
    return `message-${index}`;
  }

  if (
    typeof messageId === "string" &&
    messageId.trim().length > 0 &&
    !hasControlChars(messageId.trim())
  ) {
    return messageId.trim();
  }

  return `message-${index}`;
}
