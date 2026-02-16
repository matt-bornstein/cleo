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

        const candidate = message as { id?: unknown };
        const normalizedId =
          typeof candidate.id === "string" &&
          candidate.id.trim().length > 0 &&
          !hasControlChars(candidate.id.trim())
            ? candidate.id.trim()
            : `message-${index}`;
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
