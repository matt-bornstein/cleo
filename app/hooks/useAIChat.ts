"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  MAX_PROMPT_LENGTH,
} from "@/lib/ai/constraints";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { getModelConfig } from "@/lib/ai/models";
import { listMessagesByDocument, saveMessage } from "@/lib/ai/chatStore";
import { getRecentMessages } from "@/lib/ai/history";
import { normalizeAIUserId } from "@/lib/ai/identity";
import { createDiff } from "@/lib/diffs/store";
import type { AIMessage } from "@/lib/types";
import { generateLocalId } from "@/lib/utils/id";
import { hasDisallowedTextControlChars } from "@/lib/validators/controlChars";

const DEFAULT_MODEL = "gpt-4o";

type UseAIChatArgs = {
  documentId: string;
  currentDocumentContent: string;
  onApplyContent: (nextContent: string) => void;
  currentUserId: string;
  defaultModel?: string;
  chatClearedAt?: number;
  onClearChat?: (clearedAt: number) => void;
};

function createMessage(
  documentId: string,
  userId: string,
  role: AIMessage["role"],
  content: string,
  model?: string,
): AIMessage {
  return {
    id: generateLocalId(),
    documentId,
    userId,
    role,
    content,
    model,
    createdAt: Math.max(0, Date.now()),
  };
}

function normalizeModelId(modelId?: string) {
  if (!modelId) return DEFAULT_MODEL;
  return getModelConfig(modelId).id;
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
  currentUserId,
  defaultModel,
  chatClearedAt,
  onClearChat,
}: UseAIChatArgs) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [selectedModel, setSelectedModel] = useState(() =>
    normalizeModelId(defaultModel),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSendingRef = useRef(false);
  const normalizedDocumentId = useMemo(
    () => normalizeDocumentId(documentId),
    [documentId],
  );
  const hasValidDocumentId = useMemo(
    () => isValidDocumentId(documentId),
    [documentId],
  );
  const normalizedCurrentUserId = useMemo(
    () => normalizeAIUserId(currentUserId),
    [currentUserId],
  );

  useEffect(() => {
    if (!hasValidDocumentId) {
      setMessages([]);
      return;
    }
    setMessages(listMessagesByDocument(normalizedDocumentId, chatClearedAt));
  }, [chatClearedAt, hasValidDocumentId, normalizedDocumentId]);

  useEffect(() => {
    if (defaultModel) {
      setSelectedModel(normalizeModelId(defaultModel));
    }
  }, [defaultModel]);

  const updateSelectedModel = useCallback((modelId: string) => {
    setSelectedModel(normalizeModelId(modelId));
  }, []);

  const sendPrompt = useCallback(
    async (prompt: string) => {
      if (isSendingRef.current) return;
      if (!hasValidDocumentId) {
        setError("Document is unavailable.");
        return;
      }
      if (typeof prompt !== "string") {
        setError("Prompt is required.");
        return;
      }
      const normalizedPrompt = prompt.trim();
      if (!normalizedPrompt) {
        setError("Prompt is required.");
        return;
      }
      if (normalizedPrompt.length > MAX_PROMPT_LENGTH) {
        setError("Prompt must be 4,000 characters or less.");
        return;
      }
      if (hasDisallowedTextControlChars(normalizedPrompt)) {
        setError("Prompt contains unsupported control characters.");
        return;
      }

      isSendingRef.current = true;
      const userMessage = createMessage(
        normalizedDocumentId,
        normalizedCurrentUserId,
        "user",
        normalizedPrompt,
      );
      const assistantDraft = createMessage(
        normalizedDocumentId,
        "assistant",
        "assistant",
        "",
        selectedModel,
      );
      setMessages((prev) => [...prev, userMessage, assistantDraft]);
      saveMessage(userMessage);
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/ai/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": normalizedCurrentUserId,
          },
          body: JSON.stringify({
            documentId: normalizedDocumentId,
            prompt: normalizedPrompt,
            model: selectedModel,
            documentContent: currentDocumentContent,
            messages: getRecentMessages(
              listMessagesByDocument(normalizedDocumentId, chatClearedAt),
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
        const applyStreamPayload = (
          payload:
            | { type: "token"; text: string }
            | { type: "done"; assistantMessage: string; nextContent: string }
            | { type: "error"; error: string },
        ) => {
          if (payload.type === "token") {
            assistantContent += payload.text;
            setMessages((prev) =>
              updateMessageContent(prev, assistantDraft.id, assistantContent),
            );
            return;
          }

          if (payload.type === "done") {
            const didContentChange = payload.nextContent !== currentDocumentContent;
            const diff = didContentChange
              ? createDiff({
                  documentId: normalizedDocumentId,
                  userId: normalizedCurrentUserId,
                  previousSnapshot: currentDocumentContent,
                  snapshotAfter: payload.nextContent,
                  source: "ai",
                  aiPrompt: normalizedPrompt,
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
            return;
          }

          throw new Error(payload.error);
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            applyStreamPayload(
              JSON.parse(line) as
                | { type: "token"; text: string }
                | { type: "done"; assistantMessage: string; nextContent: string }
                | { type: "error"; error: string },
            );
          }
        }

        if (buffer.trim()) {
          applyStreamPayload(
            JSON.parse(buffer) as
              | { type: "token"; text: string }
              | { type: "done"; assistantMessage: string; nextContent: string }
              | { type: "error"; error: string },
          );
        }
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unknown AI request error";
        const errorContent = `Error: ${message}`;
        setError(message);
        setMessages((prev) =>
          updateMessageContent(prev, assistantDraft.id, errorContent),
        );
        saveMessage({
          ...assistantDraft,
          content: errorContent,
        });
      } finally {
        isSendingRef.current = false;
        setIsLoading(false);
      }
    },
    [
      currentDocumentContent,
      chatClearedAt,
      hasValidDocumentId,
      normalizedDocumentId,
      normalizedCurrentUserId,
      onApplyContent,
      selectedModel,
    ],
  );

  const selectedModelLabel = useMemo(
    () => getModelConfig(selectedModel).label,
    [selectedModel],
  );

  const clearChat = useCallback(() => {
    const clearedAt = Math.max(0, Date.now());
    onClearChat?.(clearedAt);
    setMessages([]);
    setError(null);
  }, [onClearChat]);

  return {
    messages,
    selectedModel,
    selectedModelLabel,
    setSelectedModel: updateSelectedModel,
    sendPrompt,
    isLoading,
    error,
    clearChat,
  };
}
