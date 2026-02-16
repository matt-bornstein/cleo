"use client";

import { Bot, User, CheckCircle2 } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useMemo } from "react";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  userName?: string;
  model?: string;
  diffId?: Id<"diffs">;
}

export function MessageBubble({
  role,
  content,
  userName,
  model,
  diffId,
}: MessageBubbleProps) {
  const isUser = role === "user";

  // For assistant messages, render basic formatting
  const renderedContent = useMemo(() => {
    if (isUser) return null;
    return renderAssistantContent(content);
  }, [content, isUser]);

  return (
    <div className="flex gap-3 py-3">
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
        {isUser ? (
          <div className="text-sm whitespace-pre-wrap break-words">
            {content}
          </div>
        ) : (
          <div
            className="ai-message-content text-sm break-words"
            dangerouslySetInnerHTML={{ __html: renderedContent || "" }}
          />
        )}
        {diffId && (
          <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            <span>Changes applied to document</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Basic rendering of AI assistant messages.
 * Converts code fences and search/replace blocks into styled HTML,
 * and applies basic inline formatting.
 */
function renderAssistantContent(content: string): string {
  let html = escapeHtml(content);

  // Convert code fences: ```language\ncode\n``` → <pre><code>
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, lang, code) => {
      return `<pre class="ai-code-block"><code>${code.trim()}</code></pre>`;
    }
  );

  // Convert search/replace blocks to styled display
  html = html.replace(
    /&lt;&lt;&lt;SEARCH\n([\s\S]*?)\n===\n([\s\S]*?)\n&gt;&gt;&gt;/g,
    (_match, search, replace) => {
      return `<div class="ai-diff-block"><div class="ai-diff-search"><span class="ai-diff-label">Find:</span><pre>${search.trim()}</pre></div><div class="ai-diff-replace"><span class="ai-diff-label">Replace:</span><pre>${replace.trim()}</pre></div></div>`;
    }
  );

  // Convert inline code: `code` → <code>
  html = html.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

  // Convert bold: **text** → <strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Convert italic: *text* → <em> (careful not to match **)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");

  // Convert newlines to <br>
  html = html.replace(/\n/g, "<br>");

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
