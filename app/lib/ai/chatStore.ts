import type { AIMessage } from "@/lib/types";

const STORAGE_KEY = "plan00.aiMessages.v1";

type AIMessageState = {
  messages: AIMessage[];
};

const inMemoryState: AIMessageState = {
  messages: [],
};

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function loadState(): AIMessageState {
  if (!canUseStorage()) return inMemoryState;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { messages: [] };
  try {
    const parsed = JSON.parse(raw) as AIMessageState;
    return parsed.messages ? { messages: parsed.messages } : { messages: [] };
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
  const state = loadState();
  const clearedAt = chatClearedAt ?? 0;
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

export function resetMessagesForTests() {
  persistState({ messages: [] });
}
