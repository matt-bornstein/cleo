"use client";

import { Bot, User, CheckCircle2, FileEdit, Undo2, Redo2, ArrowRight } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEditorContext } from "@/components/editor/EditorContext";
import { clearDiffHighlights, addDiffHighlight, diffHighlightsState } from "@/lib/editor/diffHighlights";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  userName?: string;
  model?: string;
  diffId?: Id<"diffs">;
  isStreaming?: boolean;
  renderedPrompt?: string;
  documentId?: Id<"documents">;
  showControls?: boolean;
}

export function MessageBubble({
  role,
  content,
  userName,
  model,
  diffId,
  isStreaming = false,
  renderedPrompt,
  documentId,
  showControls = false,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const [showRaw, setShowRaw] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const undoAiEdit = useAction(api.undoAction.undoAiEdit);
  const diff = useQuery(api.diffs.getVersion, diffId ? { diffId } : "skip");
  const isUndone = diff?.undone === true;
  const { diffCount, setDiffCount, refreshDecorations } = useEditorContext();
  const hasActiveHighlights = diffCount > 0;

  const { html: renderedContent, isEditingNow } = useMemo(() => {
    if (isUser) return { html: null, isEditingNow: false };
    return renderAssistantContent(content, isStreaming);
  }, [content, isUser, isStreaming]);

  return (
    <>
    <div
      className="flex gap-3 py-3 rounded-md -mx-1 px-1"
    >
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
          {!isStreaming && (
            <button
              className="cursor-pointer text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              onClick={() => setShowRaw(true)}
            >
              raw
            </button>
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
            <span>
              Editing document
              <span className="editing-dots">
                <span className="editing-dot" style={{ animationDelay: "0s" }}>.</span>
                <span className="editing-dot" style={{ animationDelay: "0.2s" }}>.</span>
                <span className="editing-dot" style={{ animationDelay: "0.4s" }}>.</span>
              </span>
            </span>
          </div>
        )}
        {diffId && (
          showControls ? (
            <div className={`mt-1 flex items-center gap-1 text-xs ${isUndone ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"}`}>
              {isUndone ? (
                <>
                  <Undo2 className="h-3 w-3" />
                  <span>Changes undone</span>
                </>
              ) : hasActiveHighlights ? (
                <button
                  className="cursor-pointer inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearDiffHighlights();
                    setDiffCount(0);
                    refreshDecorations();
                  }}
                >
                  <ArrowRight className="h-3 w-3" />
                  <span>Accept changes</span>
                </button>
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Changes applied</span>
                </>
              )}
              {documentId && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <button
                    className="cursor-pointer inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={isUndoing}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const actionName = isUndone ? "Reapply" : "Undo";
                    setIsUndoing(true);
                      try {
                        await undoAiEdit({ documentId, diffId, reapply: isUndone });

                        // After reapply succeeds, restore diff highlights from saved data
                        if (isUndone && diff?.highlightData?.length) {
                          clearDiffHighlights();
                          for (const fragment of diff.highlightData) {
                            // Parse JSON entries (search+replace) or fall back to plain string (replace only)
                            try {
                              const parsed = JSON.parse(fragment);
                              if (parsed.replace || parsed.search) {
                                addDiffHighlight(parsed.replace || "", parsed.search, parsed.contextAfter);
                              }
                            } catch {
                              addDiffHighlight(fragment);
                            }
                          }
                          for (const delay of [300, 700, 1500]) {
                            setTimeout(() => {
                              refreshDecorations();
                              setDiffCount(diffHighlightsState.diffs.length);
                            }, delay);
                          }
                        }
                      } catch (err) {
                        console.error(`Failed to ${actionName.toLowerCase()}:`, err);
                      } finally {
                        setIsUndoing(false);
                      }
                    }}
                  >
                    {isUndone ? <Redo2 className="h-3 w-3" /> : <Undo2 className="h-3 w-3" />}
                    <span>
                      {isUndoing
                        ? (isUndone ? "Reapplying..." : "Undoing...")
                        : (isUndone ? "Reapply" : "Undo")}
                    </span>
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              <span>Changes applied</span>
            </div>
          )
        )}
      </div>
    </div>

    <Dialog open={showRaw} onOpenChange={setShowRaw}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>
            {isUser ? "Rendered Prompt" : "Raw AI Response"}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[400px] rounded-md border">
          <pre className="p-4 text-xs whitespace-pre-wrap break-words font-mono">
            {isUser ? (renderedPrompt || "Rendered prompt not available for this message.") : content}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
    </>
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

  const srRegex = /<<<SEARCH\n[\s\S]*?\n===\n[\s\S]*?>>>/g;
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
  const partialSR = content.search(/<<<SEARCH(?!\n[\s\S]*?\n===\n[\s\S]*?>>>)[\s\S]*$/);
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
