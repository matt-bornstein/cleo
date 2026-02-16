import type { AIMessage } from "@/lib/types";

const STORAGE_KEY = "plan00.aiMessages.v1";

type AIMessageState = {
  messages: AIMessage[];
  chatClearedAtByDocument: Record<string, number>;
};

const inMemoryState: AIMessageState = {
  messages: [],
  chatClearedAtByDocument: {},
};

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function loadState(): AIMessageState {
  if (!canUseStorage()) return inMemoryState;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { messages: [], chatClearedAtByDocument: {} };
  try {
    const parsed = JSON.parse(raw) as AIMessageState;
    return parsed.messages
      ? {
          messages: parsed.messages,
          chatClearedAtByDocument: parsed.chatClearedAtByDocument ?? {},
        }
      : { messages: [], chatClearedAtByDocument: {} };
  } catch {
    return { messages: [], chatClearedAtByDocument: {} };
  }
}

function persistState(state: AIMessageState) {
  if (!canUseStorage()) {
    inMemoryState.messages = state.messages;
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function listMessagesByDocument(documentId: string) {
  const state = loadState();
  const clearedAt = state.chatClearedAtByDocument[documentId] ?? 0;
  return state.messages
    .filter((message) => message.documentId === documentId)
    .filter((message) => message.createdAt >= clearedAt)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function saveMessage(message: AIMessage) {
  const state = loadState();
  state.messages = [...state.messages, message];
  persistState(state);
  return message;
}

export function clearMessagesForDocument(documentId: string) {
  const state = loadState();
  state.chatClearedAtByDocument[documentId] = Date.now();
  persistState(state);
}

export function resetMessagesForTests() {
  persistState({ messages: [], chatClearedAtByDocument: {} });
}
