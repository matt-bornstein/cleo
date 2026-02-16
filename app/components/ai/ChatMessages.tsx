import type { AIMessage } from "@/lib/types";
import { MessageBubble } from "@/components/ai/MessageBubble";

type ChatMessagesProps = {
  messages: AIMessage[];
};

export function ChatMessages({ messages }: ChatMessagesProps) {
  if (messages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
        Ask the assistant to rewrite, summarize, or edit your document.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
