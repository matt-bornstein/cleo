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
  documentId: unknown;
  currentDocumentContent: unknown;
  onApplyContent: unknown;
  currentUserId: unknown;
  defaultModel?: unknown;
  chatClearedAt?: unknown;
  onClearChat?: unknown;
};

type AIStreamPayload =
  | { type: "token"; text: string }
  | { type: "done"; assistantMessage: string; nextContent: string }
  | { type: "error"; error: string };

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
    createdAt: safeNow(),
  };
}

function normalizeModelId(modelId?: unknown) {
  if (typeof modelId !== "string" || modelId.trim().length === 0) {
    return DEFAULT_MODEL;
  }
  return safeGetModelConfigId(modelId.trim());
}

function updateMessageContent(messages: AIMessage[], messageId: string, content: string) {
  return messages.map((message) => {
    try {
      return message.id === messageId ? { ...message, content } : message;
    } catch {
      return message;
    }
  });
}

function parseAIStreamPayload(raw: string): AIStreamPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;
  const type = readAIStreamField(candidate, "type");
  const text = readAIStreamField(candidate, "text");
  if (type === "token" && typeof text === "string") {
    return {
      type: "token",
      text,
    };
  }

  const assistantMessage = readAIStreamField(candidate, "assistantMessage");
  const nextContent = readAIStreamField(candidate, "nextContent");
  if (
    type === "done" &&
    typeof assistantMessage === "string" &&
    typeof nextContent === "string"
  ) {
    return {
      type: "done",
      assistantMessage,
      nextContent,
    };
  }

  const error = readAIStreamField(candidate, "error");
  if (type === "error" && typeof error === "string") {
    return {
      type: "error",
      error,
    };
  }

  return null;
}

function isSuccessfulResponse(response: unknown) {
  if (!response || typeof response !== "object" || !("ok" in response)) {
    return false;
  }

  try {
    return (response as { ok?: unknown }).ok === true;
  } catch {
    return false;
  }
}

function readResponseBody(response: unknown) {
  if (!response || typeof response !== "object" || !("body" in response)) {
    return null;
  }

  try {
    const body = (response as { body?: unknown }).body;
    if (
      body &&
      typeof body === "object" &&
      "getReader" in body &&
      typeof body.getReader === "function"
    ) {
      return body as ReadableStream<Uint8Array>;
    }
  } catch {
    return null;
  }

  return null;
}

function readStreamReader(stream: unknown) {
  if (
    !stream ||
    typeof stream !== "object" ||
    !("getReader" in stream)
  ) {
    return null;
  }

  try {
    const getReader = (stream as { getReader?: unknown }).getReader;
    if (typeof getReader !== "function") {
      return null;
    }

    return Reflect.apply(getReader, stream, []) as ReadableStreamDefaultReader<Uint8Array>;
  } catch {
    return null;
  }
}

async function readResponseJson(response: unknown) {
  if (!response || typeof response !== "object" || !("json" in response)) {
    return null;
  }

  let jsonFn: unknown;
  try {
    jsonFn = (response as { json?: unknown }).json;
  } catch {
    return null;
  }
  if (typeof jsonFn !== "function") {
    return null;
  }

  try {
    return await Reflect.apply(jsonFn, response, []);
  } catch {
    return null;
  }
}

function toRequestErrorMessage(payload: unknown) {
  const error = readPayloadError(payload);
  if (typeof error === "string") {
    const normalizedError = error.trim();
    if (normalizedError.length > 0) {
      return normalizedError;
    }
  }

  return "AI request failed";
}

function readPayloadError(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("error" in payload)) {
    return undefined;
  }

  try {
    return (payload as { error?: unknown }).error;
  } catch {
    return undefined;
  }
}

function readAIStreamField(
  payload: Record<string, unknown>,
  key: "type" | "text" | "assistantMessage" | "nextContent" | "error",
) {
  try {
    return payload[key];
  } catch {
    return undefined;
  }
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
    () => isValidDocumentId(normalizedDocumentId),
    [normalizedDocumentId],
  );
  const normalizedCurrentDocumentContent = useMemo(
    () => (typeof currentDocumentContent === "string" ? currentDocumentContent : ""),
    [currentDocumentContent],
  );
  const normalizedCurrentUserId = useMemo(
    () => normalizeAIUserId(currentUserId),
    [currentUserId],
  );
  const normalizedChatClearedAt = useMemo(
    () =>
      typeof chatClearedAt === "number" &&
      Number.isFinite(chatClearedAt) &&
      chatClearedAt >= 0
        ? chatClearedAt
        : undefined,
    [chatClearedAt],
  );

  useEffect(() => {
    if (!hasValidDocumentId) {
      setMessages([]);
      return;
    }
    setMessages(
      safeListMessagesByDocument(normalizedDocumentId, normalizedChatClearedAt),
    );
  }, [hasValidDocumentId, normalizedChatClearedAt, normalizedDocumentId]);

  useEffect(() => {
    if (defaultModel) {
      setSelectedModel(normalizeModelId(defaultModel));
    }
  }, [defaultModel]);

  const updateSelectedModel = useCallback((modelId: unknown) => {
    setSelectedModel(normalizeModelId(modelId));
  }, []);

  const sendPrompt = useCallback(
    async (prompt: unknown) => {
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
      safeSaveMessage(userMessage);
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
            documentContent: normalizedCurrentDocumentContent,
            messages: getRecentMessages(
              safeListMessagesByDocument(
                normalizedDocumentId,
                normalizedChatClearedAt,
              ),
            ),
          }),
        });

        const responseBody = readResponseBody(response);
        if (!isSuccessfulResponse(response) || !responseBody) {
          const payload = await readResponseJson(response);
          throw new Error(toRequestErrorMessage(payload));
        }

        const reader = readStreamReader(responseBody);
        if (!reader) {
          throw new Error("AI request failed");
        }
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantContent = "";
        const applyStreamPayload = (payload: AIStreamPayload) => {
          if (payload.type === "token") {
            assistantContent += payload.text;
            setMessages((prev) =>
              updateMessageContent(prev, assistantDraft.id, assistantContent),
            );
            return;
          }

          if (payload.type === "done") {
            const didContentChange =
              payload.nextContent !== normalizedCurrentDocumentContent;
            const diff = didContentChange
              ? safeCreateDiff({
                  documentId: normalizedDocumentId,
                  userId: normalizedCurrentUserId,
                  previousSnapshot: normalizedCurrentDocumentContent,
                  snapshotAfter: payload.nextContent,
                  source: "ai",
                  aiPrompt: normalizedPrompt,
                  aiModel: selectedModel,
                })
              : undefined;

            setMessages((prev) =>
              updateMessageContent(prev, assistantDraft.id, payload.assistantMessage),
            );
            safeSaveMessage({
              ...assistantDraft,
              content: payload.assistantMessage,
              diffId: diff?.id,
            });
            safeOnApplyContent(onApplyContent, payload.nextContent);
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
            const payload = parseAIStreamPayload(line);
            if (!payload) {
              throw new Error("Malformed AI stream event.");
            }
            applyStreamPayload(payload);
          }
        }

        if (buffer.trim()) {
          const payload = parseAIStreamPayload(buffer);
          if (!payload) {
            throw new Error("Malformed AI stream event.");
          }
          applyStreamPayload(payload);
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
        safeSaveMessage({
          ...assistantDraft,
          content: errorContent,
        });
      } finally {
        isSendingRef.current = false;
        setIsLoading(false);
      }
    },
    [
      hasValidDocumentId,
      normalizedCurrentDocumentContent,
      normalizedDocumentId,
      normalizedChatClearedAt,
      normalizedCurrentUserId,
      onApplyContent,
      selectedModel,
    ],
  );

  const selectedModelLabel = useMemo(
    () => safeGetModelConfigLabel(selectedModel),
    [selectedModel],
  );

  const clearChat = useCallback(() => {
    const clearedAt = safeNow();
    safeOnClearChat(onClearChat, clearedAt);
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

function safeNow() {
  try {
    return Math.max(0, Date.now());
  } catch {
    return 0;
  }
}

function safeGetModelConfigId(modelId: string) {
  try {
    return getModelConfig(modelId).id;
  } catch {
    return DEFAULT_MODEL;
  }
}

function safeGetModelConfigLabel(modelId: string) {
  try {
    return getModelConfig(modelId).label;
  } catch {
    try {
      return getModelConfig(DEFAULT_MODEL).label;
    } catch {
      return DEFAULT_MODEL;
    }
  }
}

function safeListMessagesByDocument(
  documentId: string,
  chatClearedAt?: number,
) {
  let listedMessages: unknown;
  try {
    listedMessages = listMessagesByDocument(documentId, chatClearedAt);
  } catch {
    return [];
  }

  return normalizeListedMessages(listedMessages, documentId);
}

function safeSaveMessage(message: AIMessage) {
  try {
    saveMessage(message);
  } catch {
    return;
  }
}

function safeCreateDiff(payload: Parameters<typeof createDiff>[0]) {
  try {
    return createDiff(payload);
  } catch {
    return undefined;
  }
}

function safeOnApplyContent(onApplyContent: unknown, nextContent: string) {
  if (typeof onApplyContent !== "function") {
    return;
  }

  try {
    onApplyContent(nextContent);
  } catch {
    return;
  }
}

function safeOnClearChat(onClearChat: unknown, clearedAt: number) {
  if (typeof onClearChat !== "function") {
    return;
  }

  try {
    onClearChat(clearedAt);
  } catch {
    return;
  }
}

function normalizeListedMessages(messages: unknown, fallbackDocumentId: string) {
  if (!Array.isArray(messages)) {
    return [] as AIMessage[];
  }

  return messages.map((message, index) =>
    normalizeListedMessage(message, fallbackDocumentId, index),
  );
}

function normalizeListedMessage(
  message: unknown,
  fallbackDocumentId: string,
  fallbackIndex: number,
): AIMessage {
  const id = readListedMessageField(message, "id");
  const documentId = readListedMessageField(message, "documentId");
  const userId = readListedMessageField(message, "userId");
  const role = readListedMessageField(message, "role");
  const content = readListedMessageField(message, "content");
  const model = readListedMessageField(message, "model");
  const diffId = readListedMessageField(message, "diffId");
  const createdAt = readListedMessageField(message, "createdAt");
  const normalizedDocumentIdCandidate =
    typeof documentId === "string" ? normalizeDocumentId(documentId) : undefined;
  const normalizedDocumentId =
    typeof normalizedDocumentIdCandidate === "string" &&
    isValidDocumentId(normalizedDocumentIdCandidate)
      ? normalizedDocumentIdCandidate
      : fallbackDocumentId;

  return {
    id:
      typeof id === "string" && id.trim().length > 0
        ? id.trim()
        : `message-${fallbackIndex}`,
    documentId: normalizedDocumentId,
    userId: normalizeAIUserId(userId),
    role:
      role === "user" || role === "assistant" || role === "system"
        ? role
        : "assistant",
    content: typeof content === "string" ? content : "",
    model:
      typeof model === "string" && model.trim().length > 0
        ? safeGetModelConfigId(model.trim())
        : undefined,
    diffId:
      typeof diffId === "string" && diffId.trim().length > 0
        ? diffId.trim()
        : undefined,
    createdAt:
      typeof createdAt === "number" && Number.isFinite(createdAt) && createdAt >= 0
        ? createdAt
        : 0,
  };
}

function readListedMessageField(
  message: unknown,
  key: keyof AIMessage,
) {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  try {
    return (message as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}
