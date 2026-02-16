import type { AIMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageBubbleProps = {
  message: AIMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <article
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        isUser
          ? "border-blue-200 bg-blue-50 text-blue-900"
          : "border-slate-200 bg-white text-slate-800",
      )}
    >
      <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide">
        <span>{isUser ? "You" : "Assistant"}</span>
        {message.model ? <span className="text-slate-500">{message.model}</span> : null}
      </div>
      <p className="whitespace-pre-wrap">{message.content || "…"}</p>
    </article>
  );
}
