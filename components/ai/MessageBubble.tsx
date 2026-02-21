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
 * Strip edit blocks from AI responses, keeping only the trailing summary
 * that comes after the last edit block. For text-only responses (no edits),
 * the full text is shown.
 */
function renderAssistantContent(content: string): string {
  let text = content;
  let lastEditEnd = -1;

  // Find the end position of every complete search/replace block
  const srRegex = /<<<SEARCH\n[\s\S]*?\n===\n[\s\S]*?\n>>>/g;
  let match;
  while ((match = srRegex.exec(text)) !== null) {
    lastEditEnd = Math.max(lastEditEnd, match.index + match[0].length);
  }

  // Find the end position of every complete HTML code fence
  const htmlRegex = /```html\n[\s\S]*?\n```/g;
  while ((match = htmlRegex.exec(text)) !== null) {
    lastEditEnd = Math.max(lastEditEnd, match.index + match[0].length);
  }

  if (lastEditEnd !== -1) {
    // Only keep text after the last edit block
    text = text.substring(lastEditEnd);
  }

  // If still streaming into an edit block, show nothing yet
  text = text.replace(/<<<SEARCH[\s\S]*$/, "");
  text = text.replace(/```html[\s\S]*$/, "");

  // If no edit blocks found but one is about to start, hide the intro text too
  if (lastEditEnd === -1 && /<<<SEARCH|```html/.test(content)) {
    text = "";
  }

  text = text.replace(/\n{3,}/g, "\n\n").trim();

  let html = escapeHtml(text);

  // Convert non-HTML code fences: ```language\ncode\n``` -> <pre><code>
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, _lang, code) => {
      return `<pre class="ai-code-block"><code>${code.trim()}</code></pre>`;
    }
  );

  // Convert inline code: `code` -> <code>
  html = html.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

  // Convert bold: **text** -> <strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Convert italic: *text* -> <em>
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
