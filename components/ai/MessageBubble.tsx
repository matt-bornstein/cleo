"use client";

import { Bot, User, CheckCircle2, FileEdit } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useMemo } from "react";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  userName?: string;
  model?: string;
  diffId?: Id<"diffs">;
  isStreaming?: boolean;
}

export function MessageBubble({
  role,
  content,
  userName,
  model,
  diffId,
  isStreaming = false,
}: MessageBubbleProps) {
  const isUser = role === "user";

  const { html: renderedContent, isEditingNow } = useMemo(() => {
    if (isUser) return { html: null, isEditingNow: false };
    return renderAssistantContent(content, isStreaming);
  }, [content, isUser, isStreaming]);

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
        {isEditingNow && (
          <div className="mt-1 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
            <FileEdit className="h-3 w-3" />
            <span>Editing document...</span>
          </div>
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
 * During streaming: show the intro text until edit blocks finish, then
 * switch to the summary that follows the blocks.
 * For saved messages: always show only the summary after edit blocks.
 */
function renderAssistantContent(
  content: string,
  isStreaming: boolean
): { html: string; isEditingNow: boolean } {
  let text = content;
  let lastEditEnd = -1;
  let firstEditStart = -1;

  const srRegex = /<<<SEARCH\n[\s\S]*?\n===\n[\s\S]*?\n>>>/g;
  let match;
  while ((match = srRegex.exec(text)) !== null) {
    if (firstEditStart === -1) firstEditStart = match.index;
    lastEditEnd = Math.max(lastEditEnd, match.index + match[0].length);
  }

  const htmlRegex = /```html\n[\s\S]*?\n```/g;
  while ((match = htmlRegex.exec(text)) !== null) {
    if (firstEditStart === -1 || match.index < firstEditStart) {
      firstEditStart = match.index;
    }
    lastEditEnd = Math.max(lastEditEnd, match.index + match[0].length);
  }

  // Check for a partial (in-progress) edit block at the end
  const partialSR = content.search(/<<<SEARCH(?!\n[\s\S]*?\n===\n[\s\S]*?\n>>>)[\s\S]*$/);
  const partialHTML = content.search(/```html(?!\n[\s\S]*?\n```)[\s\S]*$/);
  const hasPartialBlock =
    (partialSR !== -1 && partialSR >= lastEditEnd) ||
    (partialHTML !== -1 && partialHTML >= lastEditEnd);

  const isEditingNow = isStreaming && hasPartialBlock;

  if (isStreaming && lastEditEnd === -1 && !hasPartialBlock) {
    // Still in the intro phase, no blocks yet — show everything
    text = content;
  } else if (isStreaming && lastEditEnd === -1 && hasPartialBlock) {
    // A block has started but hasn't completed — show intro up to it
    const cutoff = Math.min(
      ...[partialSR, partialHTML].filter((i) => i !== -1)
    );
    text = content.substring(0, cutoff);
  } else if (lastEditEnd !== -1) {
    // Blocks have completed — show the summary after the last block
    let summary = content.substring(lastEditEnd);
    summary = summary.replace(/<<<SEARCH[\s\S]*$/, "");
    summary = summary.replace(/```html[\s\S]*$/, "");
    summary = summary.replace(/\n{3,}/g, "\n\n").trim();

    if (summary) {
      text = summary;
    } else {
      // No summary — fall back to the intro before the first block
      text = firstEditStart > 0 ? content.substring(0, firstEditStart) : content;
    }
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

  return { html, isEditingNow };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
