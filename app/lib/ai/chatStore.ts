import { MAX_MESSAGE_CONTENT_LENGTH } from "@/lib/ai/constraints";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { normalizeAIUserId } from "@/lib/ai/identity";
import type { AIMessage } from "@/lib/types";

const STORAGE_KEY = "plan00.aiMessages.v1";

type AIMessageState = {
  messages: AIMessage[];
};

const inMemoryState: AIMessageState = {
  messages: [],
};
const ALLOWED_MESSAGE_ROLES = new Set<AIMessage["role"]>([
  "user",
  "assistant",
  "system",
]);

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function loadState(): AIMessageState {
  if (!canUseStorage()) return inMemoryState;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { messages: [] };
  try {
    const parsed = JSON.parse(raw) as AIMessageState;
    if (!parsed.messages) {
      return { messages: [] };
    }

    const sanitizedMessages = parsed.messages.flatMap((message) => {
        const normalized = normalizeMessage(message);
        return normalized ? [normalized] : [];
      });

    const dedupedByMessageId = new Map<string, AIMessage>();
    for (const message of sanitizedMessages) {
      const existing = dedupedByMessageId.get(message.id);
      if (!existing) {
        dedupedByMessageId.set(message.id, message);
        continue;
      }

      if (message.createdAt > existing.createdAt) {
        dedupedByMessageId.set(message.id, message);
      }
    }

    return {
      messages: Array.from(dedupedByMessageId.values()),
    };
  } catch {
    return { messages: [] };
  }
}

function persistState(state: AIMessageState) {
  if (!canUseStorage()) {
    inMemoryState.messages = state.messages;
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function listMessagesByDocument(documentId: string, chatClearedAt?: number) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) return [];

  const state = loadState();
  const clearedAt =
    typeof chatClearedAt === "number" && Number.isFinite(chatClearedAt)
      ? chatClearedAt
      : 0;
  return state.messages
    .filter((message) => message.documentId === normalizedDocumentId)
    .filter((message) => message.createdAt >= clearedAt)
    .sort((a, b) =>
      a.createdAt === b.createdAt
        ? a.id.localeCompare(b.id)
        : a.createdAt - b.createdAt,
    );
}

export function saveMessage(message: AIMessage) {
  const normalized = normalizeMessage(message);
  if (!normalized) {
    return null;
  }

  const state = loadState();
  state.messages = [...state.messages, normalized];
  persistState(state);
  return state.messages[state.messages.length - 1];
}

export function resetMessagesForTests() {
  persistState({ messages: [] });
}

function normalizeMessage(message: AIMessage): AIMessage | null {
  const normalizedDocumentId = normalizeDocumentId(message.documentId);
  const normalizedMessageId = message.id?.trim();
  if (
    !normalizedMessageId ||
    !isValidDocumentId(normalizedDocumentId) ||
    !ALLOWED_MESSAGE_ROLES.has(message.role) ||
    typeof message.content !== "string" ||
    message.content.trim().length === 0 ||
    message.content.length > MAX_MESSAGE_CONTENT_LENGTH ||
    typeof message.createdAt !== "number" ||
    !Number.isFinite(message.createdAt)
  ) {
    return null;
  }

  return {
    ...message,
    id: normalizedMessageId,
    documentId: normalizedDocumentId,
    userId: normalizeAIUserId(message.userId),
  };
}
