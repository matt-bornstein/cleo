import { MAX_MESSAGE_CONTENT_LENGTH, MAX_USER_ID_LENGTH } from "@/lib/ai/constraints";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { normalizeAIUserId } from "@/lib/ai/identity";
import { getModelConfig } from "@/lib/ai/models";
import type { AIMessage } from "@/lib/types";
import {
  hasControlChars,
  hasDisallowedTextControlChars,
} from "@/lib/validators/controlChars";

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

function getStorage() {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function loadState(): AIMessageState {
  const storage = getStorage();
  if (!storage) return inMemoryState;
  const raw = safeGetItem(storage, STORAGE_KEY);
  if (!raw) return { messages: [] };
  try {
    const parsed = JSON.parse(raw) as { messages?: unknown };
    if (!Array.isArray(parsed.messages)) {
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
  inMemoryState.messages = [...state.messages];
  const storage = getStorage();
  if (!storage) {
    return;
  }
  safeSetItem(storage, STORAGE_KEY, JSON.stringify(state));
}

export function listMessagesByDocument(documentId: unknown, chatClearedAt?: unknown) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) return [];

  const state = loadState();
  const clearedAt =
    typeof chatClearedAt === "number" &&
    Number.isFinite(chatClearedAt) &&
    chatClearedAt >= 0
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

export function saveMessage(message: unknown) {
  const normalized = normalizeMessage(message);
  if (!normalized) {
    return null;
  }

  const state = loadState();
  const existingIndex = state.messages.findIndex(
    (entry) => entry.id === normalized.id,
  );
  if (existingIndex === -1) {
    state.messages = [...state.messages, normalized];
    persistState(state);
    return state.messages[state.messages.length - 1];
  }

  const existing = state.messages[existingIndex];
  if (existing.createdAt >= normalized.createdAt) {
    return existing;
  }

  state.messages[existingIndex] = normalized;
  persistState(state);
  return state.messages[existingIndex];
}

export function resetMessagesForTests() {
  inMemoryState.messages = [];
  persistState({ messages: [] });
}

function normalizeMessage(message: unknown): AIMessage | null {
  if (!message || typeof message !== "object") {
    return null;
  }
  const candidate = message as Partial<AIMessage>;

  const documentId = safeReadMessageField(candidate, "documentId");
  const normalizedDocumentId = normalizeDocumentId(documentId);
  const id = safeReadMessageField(candidate, "id");
  const normalizedMessageId =
    typeof id === "string" ? id.trim() : undefined;
  const role = safeReadMessageField(candidate, "role");
  const content = safeReadMessageField(candidate, "content");
  const createdAt = safeReadMessageField(candidate, "createdAt");
  if (
    !normalizedMessageId ||
    normalizedMessageId.length > MAX_USER_ID_LENGTH ||
    hasControlChars(normalizedMessageId) ||
    !isValidDocumentId(normalizedDocumentId) ||
    !ALLOWED_MESSAGE_ROLES.has(role as AIMessage["role"]) ||
    typeof content !== "string" ||
    content.trim().length === 0 ||
    content.length > MAX_MESSAGE_CONTENT_LENGTH ||
    hasDisallowedTextControlChars(content) ||
    typeof createdAt !== "number" ||
    !Number.isFinite(createdAt) ||
    createdAt < 0
  ) {
    return null;
  }
  const userId = safeReadMessageField(candidate, "userId");
  const model = safeReadMessageField(candidate, "model");

  return {
    ...candidate,
    id: normalizedMessageId,
    documentId: normalizedDocumentId,
    role: role as AIMessage["role"],
    content,
    createdAt,
    userId: normalizeAIUserId(userId),
    model: normalizeMessageModel(model),
  };
}

function safeGetItem(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    return;
  }
}

function normalizeMessageModel(model: unknown) {
  if (typeof model !== "string" || model.trim().length === 0) {
    return undefined;
  }

  try {
    return getModelConfig(model.trim()).id;
  } catch {
    return undefined;
  }
}

function safeReadMessageField(
  message: Partial<AIMessage>,
  key:
    | "id"
    | "documentId"
    | "userId"
    | "role"
    | "content"
    | "createdAt"
    | "model",
) {
  try {
    return message[key];
  } catch {
    return undefined;
  }
}
