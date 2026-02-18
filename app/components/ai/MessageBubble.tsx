import { cn } from "@/lib/utils";
import { hasControlChars } from "@/lib/validators/controlChars";

type MessageBubbleProps = {
  message: unknown;
  onClick?: unknown;
};

export function MessageBubble({ message, onClick }: MessageBubbleProps) {
  const candidate =
    message && typeof message === "object"
      ? (message as {
          role?: unknown;
          model?: unknown;
          content?: unknown;
          diffId?: unknown;
        })
      : undefined;
  const normalizedRole = readMessageRole(candidate);
  const model = readMessageField(candidate, "model");
  const normalizedModel =
    typeof model === "string" &&
    model.trim().length > 0 &&
    !hasControlChars(model.trim())
      ? model.trim()
      : undefined;
  const content = readMessageField(candidate, "content");
  const normalizedContent =
    typeof content === "string" ? content : "";
  const diffId = readMessageField(candidate, "diffId");
  const hasDiffId =
    typeof diffId === "string" &&
    diffId.trim().length > 0 &&
    !hasControlChars(diffId.trim());
  const isUser = normalizedRole === "user";
  const isInteractive = typeof onClick === "function";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <article
        className={cn(
          "relative max-w-[92%] rounded-lg border px-3 py-2 text-left text-sm",
          isInteractive ? "cursor-pointer transition-shadow hover:shadow-sm" : "",
          isUser
            ? "border-blue-200 bg-blue-50 text-blue-900"
            : "border-slate-200 bg-white text-slate-800",
        )}
        onClick={() => {
          safeOnClick(onClick);
        }}
        onKeyDown={(event) => {
          if (!isInteractive) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            safeOnClick(onClick);
          }
        }}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
      >
        {isUser ? (
          <>
            <span
              aria-hidden="true"
              className="absolute right-[-9px] top-3 h-0 w-0 border-y-[8px] border-l-[10px] border-y-transparent border-l-blue-200"
            />
            <span
              aria-hidden="true"
              className="absolute right-[-8px] top-3 h-0 w-0 border-y-[8px] border-l-[10px] border-y-transparent border-l-blue-50"
            />
          </>
        ) : (
          <>
            <span
              aria-hidden="true"
              className="absolute left-[-9px] top-3 h-0 w-0 border-y-[8px] border-r-[10px] border-y-transparent border-r-slate-200"
            />
            <span
              aria-hidden="true"
              className="absolute left-[-8px] top-3 h-0 w-0 border-y-[8px] border-r-[10px] border-y-transparent border-r-white"
            />
          </>
        )}
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
    </div>
  );
}

function readMessageRole(
  candidate:
    | {
        role?: unknown;
      }
    | undefined,
) {
  const role = readMessageField(candidate, "role");
  return role === "user" ? "user" : "assistant";
}

function readMessageField(
  candidate:
    | {
        role?: unknown;
        model?: unknown;
        content?: unknown;
        diffId?: unknown;
      }
    | undefined,
  key: "role" | "model" | "content" | "diffId",
) {
  if (!candidate) {
    return undefined;
  }

  try {
    return candidate[key];
  } catch {
    return undefined;
  }
}

function safeOnClick(onClick: unknown) {
  if (typeof onClick !== "function") {
    return;
  }

  try {
    onClick();
  } catch {
    return;
  }
}
