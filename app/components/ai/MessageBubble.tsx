import { cn } from "@/lib/utils";
import { hasControlChars } from "@/lib/validators/controlChars";

type MessageBubbleProps = {
  message: unknown;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const candidate =
    message && typeof message === "object"
      ? (message as {
          role?: unknown;
          model?: unknown;
          content?: unknown;
          diffId?: unknown;
        })
      : undefined;
  const normalizedRole = candidate?.role === "user" ? "user" : "assistant";
  const normalizedModel =
    typeof candidate?.model === "string" &&
    candidate.model.trim().length > 0 &&
    !hasControlChars(candidate.model.trim())
      ? candidate.model.trim()
      : undefined;
  const normalizedContent =
    typeof candidate?.content === "string" ? candidate.content : "";
  const hasDiffId =
    typeof candidate?.diffId === "string" &&
    candidate.diffId.trim().length > 0 &&
    !hasControlChars(candidate.diffId.trim());
  const isUser = normalizedRole === "user";

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
        {normalizedModel ? <span className="text-slate-500">{normalizedModel}</span> : null}
      </div>
      <p className="whitespace-pre-wrap">{normalizedContent || "…"}</p>
      {hasDiffId ? (
        <div className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          Changes applied
        </div>
      ) : null}
    </article>
  );
}
