import type { PresenceRecord } from "@/lib/types";

const STORAGE_KEY = "plan00.presence.v1";

type PresenceState = {
  presence: PresenceRecord[];
};

const inMemoryState: PresenceState = { presence: [] };

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function loadState(): PresenceState {
  if (!canUseStorage()) return inMemoryState;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { presence: [] };
  try {
    const parsed = JSON.parse(raw) as PresenceState;
    return parsed.presence ? parsed : { presence: [] };
  } catch {
    return { presence: [] };
  }
}

function persistState(state: PresenceState) {
  if (!canUseStorage()) {
    inMemoryState.presence = state.presence;
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function updatePresence(record: Omit<PresenceRecord, "id" | "updatedAt">) {
  const state = loadState();
  const now = Date.now();
  const existingIndex = state.presence.findIndex(
    (entry) => entry.visitorId === record.visitorId,
  );
  const nextRecord: PresenceRecord = {
    ...record,
    id: existingIndex === -1 ? crypto.randomUUID() : state.presence[existingIndex].id,
    updatedAt: now,
  };
  if (existingIndex === -1) {
    state.presence.push(nextRecord);
  } else {
    state.presence[existingIndex] = nextRecord;
  }
  persistState(state);
  return nextRecord;
}

export function removePresence(visitorId: string) {
  const state = loadState();
  state.presence = state.presence.filter((entry) => entry.visitorId !== visitorId);
  persistState(state);
}

export function listPresence(documentId: string) {
  return loadState().presence.filter((entry) => entry.documentId === documentId);
}

export function resetPresenceForTests() {
  persistState({ presence: [] });
}
