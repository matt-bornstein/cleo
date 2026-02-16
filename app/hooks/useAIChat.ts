"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getModelConfig } from "@/lib/ai/models";
import { listMessagesByDocument, saveMessage } from "@/lib/ai/chatStore";
import { getRecentMessages } from "@/lib/ai/history";
import { createDiff } from "@/lib/diffs/store";
import type { AIMessage } from "@/lib/types";

const DEFAULT_MODEL = "gpt-4o";

type UseAIChatArgs = {
  documentId: string;
  currentDocumentContent: string;
  onApplyContent: (nextContent: string) => void;
  defaultModel?: string;
  chatClearedAt?: number;
  onClearChat?: (clearedAt: number) => void;
};

function createMessage(
  documentId: string,
  role: AIMessage["role"],
  content: string,
  model?: string,
): AIMessage {
  return {
    id: crypto.randomUUID(),
    documentId,
    userId: "local-dev-user",
    role,
    content,
    model,
    createdAt: Date.now(),
  };
}

function updateMessageContent(messages: AIMessage[], messageId: string, content: string) {
  return messages.map((message) =>
    message.id === messageId ? { ...message, content } : message,
  );
}

export function useAIChat({
  documentId,
  currentDocumentContent,
  onApplyContent,
  defaultModel,
  chatClearedAt,
  onClearChat,
}: UseAIChatArgs) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [selectedModel, setSelectedModel] = useState(defaultModel ?? DEFAULT_MODEL);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages(listMessagesByDocument(documentId, chatClearedAt));
  }, [chatClearedAt, documentId]);

  useEffect(() => {
    if (defaultModel) {
      setSelectedModel(defaultModel);
    }
  }, [defaultModel]);

  const sendPrompt = useCallback(
    async (prompt: string) => {
      const userMessage = createMessage(documentId, "user", prompt);
      const assistantDraft = createMessage(documentId, "assistant", "", selectedModel);
      setMessages((prev) => [...prev, userMessage, assistantDraft]);
      saveMessage(userMessage);
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/ai/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId,
            prompt,
            model: selectedModel,
            documentContent: currentDocumentContent,
            messages: getRecentMessages(
              listMessagesByDocument(documentId, chatClearedAt),
            ),
          }),
        });

        if (!response.ok || !response.body) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "AI request failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            const payload = JSON.parse(line) as
              | { type: "token"; text: string }
              | { type: "done"; assistantMessage: string; nextContent: string }
              | { type: "error"; error: string };

            if (payload.type === "token") {
              assistantContent += payload.text;
              setMessages((prev) =>
                updateMessageContent(prev, assistantDraft.id, assistantContent),
              );
            }

            if (payload.type === "done") {
              const didContentChange = payload.nextContent !== currentDocumentContent;
              const diff = didContentChange
                ? createDiff({
                    documentId,
                    userId: "local-dev-user",
                    snapshotAfter: payload.nextContent,
                    source: "ai",
                    aiPrompt: prompt,
                    aiModel: selectedModel,
                  })
                : undefined;

              setMessages((prev) =>
                updateMessageContent(prev, assistantDraft.id, payload.assistantMessage),
              );
              saveMessage({
                ...assistantDraft,
                content: payload.assistantMessage,
                diffId: diff?.id,
              });
              onApplyContent(payload.nextContent);
            }

            if (payload.type === "error") {
              throw new Error(payload.error);
            }
          }
        }
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unknown AI request error";
        setError(message);
        setMessages((prev) =>
          updateMessageContent(prev, assistantDraft.id, `Error: ${message}`),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      currentDocumentContent,
      chatClearedAt,
      documentId,
      onApplyContent,
      selectedModel,
    ],
  );

  const selectedModelLabel = useMemo(
    () => getModelConfig(selectedModel).label,
    [selectedModel],
  );

  const clearChat = useCallback(() => {
    const clearedAt = Date.now();
    onClearChat?.(clearedAt);
    setMessages([]);
  }, [onClearChat]);

  return {
    messages,
    selectedModel,
    selectedModelLabel,
    setSelectedModel,
    sendPrompt,
    isLoading,
    error,
    clearChat,
  };
}
