"use client";

import { useState, useCallback, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface StreamEvent {
  type: "token" | "done" | "error" | "changes_applied";
  content: string;
}

export function useAIChat(documentId: Id<"documents">) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const messages = useQuery(api.ai.getMessages, { documentId });
  const acquireLock = useMutation(api.ai.acquireLock);
  const releaseLock = useMutation(api.ai.releaseLock);
  const saveMessage = useMutation(api.ai.saveMessage);
  const clearChat = useMutation(api.ai.clearChat);

  const submitPrompt = useCallback(
    async (prompt: string, model: string) => {
      setError(null);
      setStreamingContent("");

      try {
        // Save user message
        await saveMessage({
          documentId,
          role: "user",
          content: prompt,
        });

        // Acquire lock
        await acquireLock({ documentId });

        setIsStreaming(true);

        // Get the Convex HTTP actions URL
        const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 
          process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/:\d+$/, ':3211') ||
          "";

        // Start streaming
        const abortController = new AbortController();
        abortRef.current = abortController;

        const response = await fetch(`${siteUrl}/ai/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId,
            prompt,
            model,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to start AI stream");
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n").filter((l) => l.startsWith("data: "));

          for (const line of lines) {
            try {
              const event: StreamEvent = JSON.parse(line.slice(6));

              switch (event.type) {
                case "token":
                  accumulated += event.content;
                  setStreamingContent(accumulated);
                  break;
                case "done":
                  // AI message is saved server-side
                  break;
                case "changes_applied":
                  // Document was updated by the AI
                  break;
                case "error":
                  setError(event.content);
                  break;
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User cancelled
        } else {
          const msg = err instanceof Error ? err.message : "AI request failed";
          setError(msg);
          // Try to release lock on error
          try {
            await releaseLock({ documentId });
          } catch {
            // Ignore
          }
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        abortRef.current = null;
      }
    },
    [documentId, acquireLock, releaseLock, saveMessage]
  );

  const cancelStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  const handleClearChat = useCallback(async () => {
    try {
      await clearChat({ documentId });
    } catch (err) {
      console.error("Failed to clear chat:", err);
    }
  }, [documentId, clearChat]);

  return {
    messages: messages ?? [],
    isStreaming,
    streamingContent,
    error,
    submitPrompt,
    cancelStream,
    clearChat: handleClearChat,
  };
}
