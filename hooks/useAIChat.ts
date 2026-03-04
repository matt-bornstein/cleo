"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface StreamEvent {
  type: "token" | "done" | "error" | "changes_applied";
  content: string;
}

interface UseAIChatOptions {
  onChangesApplied?: (diffMetadata: string) => void;
}

export function useAIChat(documentId: Id<"documents">, options?: UseAIChatOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep a ref to the latest callback so the streaming closure always uses it
  const onChangesAppliedRef = useRef(options?.onChangesApplied);
  useEffect(() => {
    onChangesAppliedRef.current = options?.onChangesApplied;
  }, [options?.onChangesApplied]);

  const messages = useQuery(api.ai.getMessages, { documentId });
  const acquireLock = useMutation(api.ai.acquireLock);
  const releaseLock = useMutation(api.ai.releaseLock);
  const saveMessage = useMutation(api.ai.saveMessage);
  const clearChat = useMutation(api.ai.clearChat);

  const submitPrompt = useCallback(
    async (text: string, attachments: string[], model: string, options?: { thinkHarder?: boolean; verbose?: boolean; askMode?: boolean }) => {
      setError(null);
      setStreamingContent("");

      try {
        // Save user message with content and attachments stored separately
        await saveMessage({
          documentId,
          role: "user",
          content: text,
          attachments: attachments.length > 0 ? attachments : undefined,
          askMode: options?.askMode || undefined,
        });

        // Compose the full prompt for the AI (text + attachment blocks)
        let prompt = text;
        attachments.forEach((item, i) => {
          prompt += `\n\n--- Attached Data (${i + 1}) ---\n${item}`;
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
            thinkHarder: options?.thinkHarder ?? false,
            verbose: options?.verbose ?? false,
            askMode: options?.askMode ?? false,
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
                  onChangesAppliedRef.current?.(event.content);
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
