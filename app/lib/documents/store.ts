import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { MAX_USER_ID_LENGTH } from "@/lib/ai/constraints";
import { isValidDocumentContentJson } from "@/lib/ai/documentContent";
import type { AppDocument } from "@/lib/types";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";
import { normalizeEmailOrUndefined } from "@/lib/user/email";
import { generateLocalId } from "@/lib/utils/id";
import { hasControlChars } from "@/lib/validators/controlChars";
import { isValidEmail } from "@/lib/validators/email";

const STORAGE_KEY = "plan00.documents.v1";

type DocumentStoreState = {
  documents: AppDocument[];
};

const EMPTY_EDITOR_DOC = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
});
const DEFAULT_OWNER_EMAIL = DEFAULT_LOCAL_USER_EMAIL;

const inMemoryState: DocumentStoreState = {
  documents: [],
};

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

function loadState(): DocumentStoreState {
  const storage = getStorage();
  if (!storage) {
    return inMemoryState;
  }

  const raw = safeGetItem(storage, STORAGE_KEY);
  if (!raw) {
    return { documents: [] };
  }

  try {
    const parsed = JSON.parse(raw) as { documents?: unknown };
    if (!Array.isArray(parsed.documents)) {
      return { documents: [] };
    }

    const fallbackNow = safeNow();
    const sanitizedDocuments = parsed.documents.flatMap((doc) => {
        if (!doc || typeof doc !== "object") {
          return [];
        }
        const candidate = doc as Partial<AppDocument>;
        const id = safeReadPersistedDocumentField(candidate, "id");
        const title = safeReadPersistedDocumentField(candidate, "title");
        const createdAt = safeReadPersistedDocumentField(candidate, "createdAt");
        const updatedAt = safeReadPersistedDocumentField(candidate, "updatedAt");
        const content = safeReadPersistedDocumentField(candidate, "content");
        const ownerEmail = safeReadPersistedDocumentField(candidate, "ownerEmail");
        const lastDiffAt = safeReadPersistedDocumentField(candidate, "lastDiffAt");
        const chatClearedAt = safeReadPersistedDocumentField(candidate, "chatClearedAt");
        const aiLockedBy = safeReadPersistedDocumentField(candidate, "aiLockedBy");
        const aiLockedAt = safeReadPersistedDocumentField(candidate, "aiLockedAt");

        const normalizedDocumentId = normalizeDocumentId(id);
        if (!isValidDocumentId(normalizedDocumentId)) {
          return [];
        }

        const normalizedTitle = normalizeDocumentTitle(title);
        const hasValidCreatedAt =
          typeof createdAt === "number" &&
          Number.isFinite(createdAt) &&
          createdAt >= 0;
        const hasValidUpdatedAt =
          typeof updatedAt === "number" &&
          Number.isFinite(updatedAt) &&
          updatedAt >= 0;
        const normalizedCreatedAt =
          hasValidCreatedAt ? createdAt : fallbackNow;
        const normalizedUpdatedAt =
          hasValidUpdatedAt
            ? Math.max(updatedAt, normalizedCreatedAt)
            : normalizedCreatedAt;
        const normalizedDocument: AppDocument = {
          id: normalizedDocumentId,
          title: normalizedTitle,
          content: isValidDocumentContentJson(content)
            ? content
            : EMPTY_EDITOR_DOC,
          ownerEmail: normalizeOwnerEmail(ownerEmail),
          createdAt: normalizedCreatedAt,
          updatedAt: normalizedUpdatedAt,
          lastDiffAt:
            typeof lastDiffAt === "number" &&
            Number.isFinite(lastDiffAt) &&
            lastDiffAt >= 0
              ? lastDiffAt
              : undefined,
          chatClearedAt:
            typeof chatClearedAt === "number" &&
            Number.isFinite(chatClearedAt) &&
            chatClearedAt >= 0
              ? chatClearedAt
              : undefined,
          aiLockedBy:
            typeof aiLockedBy === "string" &&
            aiLockedBy.trim().length > 0 &&
            aiLockedBy.trim().length <= MAX_USER_ID_LENGTH &&
            !hasControlChars(aiLockedBy.trim())
              ? aiLockedBy.trim()
              : undefined,
          aiLockedAt:
            typeof aiLockedAt === "number" &&
            Number.isFinite(aiLockedAt) &&
            aiLockedAt >= 0
              ? aiLockedAt
              : undefined,
        };

        return [
          {
            document: normalizedDocument,
            dedupeUpdatedAt: hasValidUpdatedAt
              ? updatedAt
              : hasValidCreatedAt
                ? createdAt
                : Number.NEGATIVE_INFINITY,
          },
        ];
      });

    const dedupedByDocumentId = new Map<
      string,
      (typeof sanitizedDocuments)[number]
    >();
    for (const entry of sanitizedDocuments) {
      const existing = dedupedByDocumentId.get(entry.document.id);
      if (!existing) {
        dedupedByDocumentId.set(entry.document.id, entry);
        continue;
      }

      if (entry.dedupeUpdatedAt > existing.dedupeUpdatedAt) {
        dedupedByDocumentId.set(entry.document.id, entry);
        continue;
      }

      if (
        entry.dedupeUpdatedAt === existing.dedupeUpdatedAt &&
        entry.document.createdAt > existing.document.createdAt
      ) {
        dedupedByDocumentId.set(entry.document.id, entry);
      }
    }

    return {
      documents: Array.from(dedupedByDocumentId.values()).map((entry) => entry.document),
    };
  } catch {
    return { documents: [] };
  }
}

function persistState(state: DocumentStoreState) {
  inMemoryState.documents = [...state.documents];
  const storage = getStorage();
  if (!storage) {
    return;
  }

  safeSetItem(storage, STORAGE_KEY, JSON.stringify(state));
}

function normalizeOwnerEmail(ownerEmail: unknown) {
  const normalizedEmail = normalizeEmailOrUndefined(ownerEmail);
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return DEFAULT_OWNER_EMAIL;
  }

  return normalizedEmail;
}

export function createDocument(
  title: unknown,
  ownerEmail: unknown = DEFAULT_OWNER_EMAIL,
): AppDocument {
  const now = safeNow();
  const normalizedTitle = normalizeDocumentTitle(title);
  const state = loadState();
  const document: AppDocument = {
    id: generateLocalId(),
    title: normalizedTitle,
    content: EMPTY_EDITOR_DOC,
    ownerEmail: normalizeOwnerEmail(ownerEmail),
    createdAt: now,
    updatedAt: now,
  };

  state.documents = [document, ...state.documents];
  persistState(state);
  return document;
}

export function listDocuments(query?: unknown): AppDocument[] {
  const state = loadState();
  const normalizedQuery =
    typeof query === "string" ? query.trim().toLowerCase() : undefined;

  return state.documents
    .filter((doc) => {
      if (!normalizedQuery) return true;
      return doc.title.toLowerCase().includes(normalizedQuery);
    })
    .sort((a, b) =>
      b.updatedAt === a.updatedAt
        ? a.id.localeCompare(b.id)
        : b.updatedAt - a.updatedAt,
    );
}

export function getDocumentById(documentId: unknown): AppDocument | undefined {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) return undefined;

  const state = loadState();
  return state.documents.find((doc) => doc.id === normalizedDocumentId);
}

export function updateDocumentContent(
  documentId: unknown,
  content: unknown,
): AppDocument | undefined {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (
    !isValidDocumentId(normalizedDocumentId) ||
    !isValidDocumentContentJson(content)
  ) {
    return undefined;
  }

  const state = loadState();
  const index = state.documents.findIndex((doc) => doc.id === normalizedDocumentId);
  if (index === -1) return undefined;

  const existing = state.documents[index];
  if (existing.content === content) {
    return undefined;
  }
  const updated: AppDocument = {
    ...existing,
    content,
    updatedAt: Math.max(safeNow(), existing.updatedAt),
  };
  state.documents[index] = updated;
  persistState(state);
  return updated;
}

export function updateDocumentTitle(
  documentId: unknown,
  title: unknown,
): AppDocument | undefined {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) return undefined;

  const state = loadState();
  const index = state.documents.findIndex((doc) => doc.id === normalizedDocumentId);
  if (index === -1) return undefined;

  const normalizedTitle = normalizeDocumentTitle(title);
  const existing = state.documents[index];
  if (existing.title === normalizedTitle) {
    return undefined;
  }
  const updated: AppDocument = {
    ...existing,
    title: normalizedTitle,
    updatedAt: Math.max(safeNow(), existing.updatedAt),
  };
  state.documents[index] = updated;
  persistState(state);
  return updated;
}

export function setDocumentLastDiffAt(
  documentId: unknown,
  timestamp: unknown,
): AppDocument | undefined {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  const normalizedTimestamp =
    typeof timestamp === "number" &&
    Number.isFinite(timestamp) &&
    timestamp >= 0
      ? timestamp
      : undefined;
  if (
    !isValidDocumentId(normalizedDocumentId) ||
    normalizedTimestamp === undefined
  ) {
    return undefined;
  }

  const state = loadState();
  const index = state.documents.findIndex((doc) => doc.id === normalizedDocumentId);
  if (index === -1) return undefined;
  const existing = state.documents[index];
  if (
    existing.lastDiffAt === normalizedTimestamp ||
    (typeof existing.lastDiffAt === "number" &&
      normalizedTimestamp < existing.lastDiffAt)
  ) {
    return undefined;
  }
  const updated: AppDocument = {
    ...existing,
    lastDiffAt: normalizedTimestamp,
  };
  state.documents[index] = updated;
  persistState(state);
  return updated;
}

export function setDocumentChatClearedAt(
  documentId: unknown,
  timestamp: unknown,
): AppDocument | undefined {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  const normalizedTimestamp =
    typeof timestamp === "number" &&
    Number.isFinite(timestamp) &&
    timestamp >= 0
      ? timestamp
      : undefined;
  if (
    !isValidDocumentId(normalizedDocumentId) ||
    normalizedTimestamp === undefined
  ) {
    return undefined;
  }

  const state = loadState();
  const index = state.documents.findIndex((doc) => doc.id === normalizedDocumentId);
  if (index === -1) return undefined;
  const existing = state.documents[index];
  if (
    existing.chatClearedAt === normalizedTimestamp ||
    (typeof existing.chatClearedAt === "number" &&
      normalizedTimestamp < existing.chatClearedAt)
  ) {
    return undefined;
  }
  const updated: AppDocument = {
    ...existing,
    chatClearedAt: normalizedTimestamp,
  };
  state.documents[index] = updated;
  persistState(state);
  return updated;
}

export function deleteDocument(documentId: unknown) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) return false;

  const state = loadState();
  const beforeCount = state.documents.length;
  state.documents = state.documents.filter((doc) => doc.id !== normalizedDocumentId);
  if (state.documents.length === beforeCount) {
    return false;
  }

  persistState(state);
  return true;
}

export function resetDocumentsForTests() {
  inMemoryState.documents = [];
  persistState({ documents: [] });
}

function normalizeDocumentTitle(value: unknown) {
  const normalizedValue = typeof value === "string" ? value.trim() : undefined;
  if (!normalizedValue || hasControlChars(normalizedValue)) {
    return "Untitled";
  }

  return normalizedValue;
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

function safeReadPersistedDocumentField(
  document: Partial<AppDocument>,
  key:
    | "id"
    | "title"
    | "content"
    | "ownerEmail"
    | "createdAt"
    | "updatedAt"
    | "lastDiffAt"
    | "chatClearedAt"
    | "aiLockedBy"
    | "aiLockedAt",
) {
  try {
    return document[key];
  } catch {
    return undefined;
  }
}

function safeNow() {
  try {
    return Math.max(0, Date.now());
  } catch {
    return 0;
  }
}

