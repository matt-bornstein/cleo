"use client";

import { Bot, User } from "lucide-react";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  userName?: string;
  model?: string;
}

export function MessageBubble({
  role,
  content,
  userName,
  model,
}: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "" : ""} py-3`}>
      <div
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 space-y-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">
            {isUser ? userName || "You" : "AI Assistant"}
          </span>
          {model && (
            <span className="text-xs text-muted-foreground">{model}</span>
          )}
        </div>
        <div className="text-sm whitespace-pre-wrap break-words">{content}</div>
      </div>
    </div>
  );
}
