import type { PresenceRecord } from "@/lib/types";
import { MAX_USER_ID_LENGTH } from "@/lib/ai/constraints";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { DEFAULT_LOCAL_USER_ID } from "@/lib/user/defaults";
import { generateLocalId } from "@/lib/utils/id";
import { hasControlChars } from "@/lib/validators/controlChars";

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
    if (!parsed.presence) {
      return { presence: [] };
    }

    const sanitizedPresence = parsed.presence.flatMap((entry) => {
        const normalizedDocumentId = normalizeDocumentId(entry.documentId);
        const normalizedPresenceId = normalizePresenceRecordId(entry.id);
        const normalizedVisitorId = normalizePresenceVisitorId(entry.visitorId);
        if (
          !normalizedPresenceId ||
          !normalizedVisitorId ||
          !isValidDocumentId(normalizedDocumentId) ||
          typeof entry.updatedAt !== "number" ||
          !Number.isFinite(entry.updatedAt) ||
          entry.updatedAt < 0
        ) {
          return [];
        }

        return [
          {
            ...entry,
            id: normalizedPresenceId,
            documentId: normalizedDocumentId,
            visitorId: normalizedVisitorId,
            userId: normalizePresenceUserId(entry.userId),
          },
        ];
      });

    const dedupedByVisitorId = new Map<string, PresenceRecord>();
    for (const entry of sanitizedPresence) {
      const existing = dedupedByVisitorId.get(entry.visitorId);
      if (!existing) {
        dedupedByVisitorId.set(entry.visitorId, entry);
        continue;
      }

      if (entry.updatedAt > existing.updatedAt) {
        dedupedByVisitorId.set(entry.visitorId, entry);
        continue;
      }

      if (entry.updatedAt === existing.updatedAt && entry.id.localeCompare(existing.id) < 0) {
        dedupedByVisitorId.set(entry.visitorId, entry);
      }
    }

    return {
      presence: Array.from(dedupedByVisitorId.values()),
    };
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
  const normalizedDocumentId = normalizeDocumentId(record.documentId);
  const normalizedVisitorId = normalizePresenceVisitorId(record.visitorId);
  if (!isValidDocumentId(normalizedDocumentId) || !normalizedVisitorId) {
    return null;
  }

  const state = loadState();
  const now = Math.max(0, Date.now());
  const existingIndex = state.presence.findIndex(
    (entry) => entry.visitorId === normalizedVisitorId,
  );
  const normalizedData = normalizePresenceData(record.data);
  const normalizedExistingRecordId =
    existingIndex === -1
      ? undefined
      : normalizePresenceRecordId(state.presence[existingIndex]?.id);
  const nextRecord: PresenceRecord = {
    ...record,
    documentId: normalizedDocumentId,
    visitorId: normalizedVisitorId,
    userId: normalizePresenceUserId(record.userId),
    data: normalizedData,
    id:
      existingIndex === -1
        ? generateLocalId()
        : normalizedExistingRecordId ?? generateLocalId(),
    updatedAt:
      existingIndex === -1
        ? now
        : Math.max(now, state.presence[existingIndex].updatedAt),
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
  const normalizedVisitorId = normalizePresenceVisitorId(visitorId);
  if (!normalizedVisitorId) {
    return;
  }

  const state = loadState();
  const beforeCount = state.presence.length;
  state.presence = state.presence.filter((entry) => entry.visitorId !== normalizedVisitorId);
  if (state.presence.length === beforeCount) {
    return;
  }

  persistState(state);
}

export function listPresence(documentId: string) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) {
    return [];
  }

  return loadState()
    .presence.filter((entry) => entry.documentId === normalizedDocumentId)
    .sort((a, b) =>
      b.updatedAt === a.updatedAt
        ? a.visitorId.localeCompare(b.visitorId)
        : b.updatedAt - a.updatedAt,
    );
}

export function resetPresenceForTests() {
  persistState({ presence: [] });
}

function normalizePresenceVisitorId(value: unknown) {
  const normalizedValue = typeof value === "string" ? value.trim() : undefined;
  if (
    !normalizedValue ||
    normalizedValue.length > MAX_USER_ID_LENGTH ||
    hasControlChars(normalizedValue)
  ) {
    return undefined;
  }

  return normalizedValue;
}

function normalizePresenceRecordId(value: unknown) {
  const normalizedValue = typeof value === "string" ? value.trim() : undefined;
  if (
    !normalizedValue ||
    normalizedValue.length > MAX_USER_ID_LENGTH ||
    hasControlChars(normalizedValue)
  ) {
    return undefined;
  }

  return normalizedValue;
}

function normalizePresenceUserId(value: unknown) {
  const normalizedValue = typeof value === "string" ? value.trim() : undefined;
  if (
    !normalizedValue ||
    normalizedValue.length > MAX_USER_ID_LENGTH ||
    hasControlChars(normalizedValue)
  ) {
    return DEFAULT_LOCAL_USER_ID;
  }

  return normalizedValue;
}

function normalizePresenceData(value: unknown) {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      return null;
    }
    return JSON.parse(serialized) as unknown;
  } catch {
    return null;
  }
}
