"use client";

import { useState, useRef, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAIChat } from "@/hooks/useAIChat";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ModelSelector } from "./ModelSelector";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trash2, Bot } from "lucide-react";
import { DEFAULT_MODEL } from "@/lib/ai/models";

interface AIPanelProps {
  documentId: Id<"documents">;
}

export function AIPanel({ documentId }: AIPanelProps) {
  const [model, setModel] = useState(DEFAULT_MODEL);
  const {
    messages,
    isStreaming,
    streamingContent,
    error,
    submitPrompt,
    cancelStream,
    clearChat,
  } = useAIChat(documentId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const document = useQuery(api.documents.get, { id: documentId });
  const isLocked = document?.aiLockedBy != null;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const viewport = scrollRef.current?.closest("[data-slot='scroll-area']")
      ?.querySelector("[data-slot='scroll-area-viewport']") as HTMLElement | null;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSubmit = (prompt: string) => {
    submitPrompt(prompt, model);
  };

  return (
    <div className="flex h-full flex-col bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-background px-3 py-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">AI Assistant</h3>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className="h-7 px-2"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* AI Lock indicator (visible to all collaborators) */}
      {isLocked && !isStreaming && (
        <div className="flex items-center gap-2 border-b bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>AI is processing a request from another collaborator...</span>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="p-3">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Ask AI to help edit your document.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                It can rewrite, fix grammar, change tone, and more.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg._id}
              role={msg.role}
              content={msg.content}
              userName={msg.userName}
              model={msg.model ?? undefined}
              diffId={msg.diffId ?? undefined}
            />
          ))}

          {/* Streaming response */}
          {isStreaming && streamingContent && (
            <MessageBubble
              role="assistant"
              content={streamingContent}
              model={model}
            />
          )}

          {/* Loading indicator */}
          {isStreaming && !streamingContent && (
            <div className="flex items-center gap-2 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                AI is thinking...
              </span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Model selector and input */}
      <div className="border-t">
        <div className="px-3 pt-2">
          <ModelSelector value={model} onChange={setModel} />
        </div>
        <ChatInput
          onSubmit={handleSubmit}
          disabled={isStreaming}
          placeholder={
            isStreaming
              ? "AI is working..."
              : "Ask AI to edit your document..."
          }
        />
        {isStreaming && (
          <div className="px-3 pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelStream}
              className="w-full text-xs"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
