import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
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

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function loadState(): DocumentStoreState {
  if (!canUseStorage()) {
    return inMemoryState;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { documents: [] };
  }

  try {
    const parsed = JSON.parse(raw) as DocumentStoreState;
    if (!parsed.documents) {
      return { documents: [] };
    }

    const fallbackNow = Math.max(0, Date.now());
    const sanitizedDocuments = parsed.documents.flatMap((doc) => {
        const normalizedDocumentId = normalizeDocumentId(doc.id);
        if (!isValidDocumentId(normalizedDocumentId)) {
          return [];
        }

        const normalizedTitle = normalizeDocumentTitle(doc.title);
        const hasValidCreatedAt =
          typeof doc.createdAt === "number" &&
          Number.isFinite(doc.createdAt) &&
          doc.createdAt >= 0;
        const hasValidUpdatedAt =
          typeof doc.updatedAt === "number" &&
          Number.isFinite(doc.updatedAt) &&
          doc.updatedAt >= 0;
        const normalizedCreatedAt =
          hasValidCreatedAt ? doc.createdAt : fallbackNow;
        const normalizedUpdatedAt =
          hasValidUpdatedAt
            ? Math.max(doc.updatedAt, normalizedCreatedAt)
            : normalizedCreatedAt;

        return [
          {
            document: {
              ...doc,
              id: normalizedDocumentId,
              title: normalizedTitle,
              content: isValidDocumentContentJson(doc.content)
                ? doc.content
                : EMPTY_EDITOR_DOC,
              ownerEmail: normalizeOwnerEmail(doc.ownerEmail),
              createdAt: normalizedCreatedAt,
              updatedAt: normalizedUpdatedAt,
              lastDiffAt:
                typeof doc.lastDiffAt === "number" &&
                Number.isFinite(doc.lastDiffAt) &&
                doc.lastDiffAt >= 0
                  ? doc.lastDiffAt
                  : undefined,
              chatClearedAt:
                typeof doc.chatClearedAt === "number" &&
                Number.isFinite(doc.chatClearedAt) &&
                doc.chatClearedAt >= 0
                  ? doc.chatClearedAt
                  : undefined,
            },
            dedupeUpdatedAt: hasValidUpdatedAt
              ? doc.updatedAt
              : hasValidCreatedAt
                ? doc.createdAt
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
  if (!canUseStorage()) {
    inMemoryState.documents = state.documents;
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeOwnerEmail(ownerEmail: string | undefined) {
  const normalizedEmail = normalizeEmailOrUndefined(ownerEmail);
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return DEFAULT_OWNER_EMAIL;
  }

  return normalizedEmail;
}

export function createDocument(title: string, ownerEmail = DEFAULT_OWNER_EMAIL): AppDocument {
  const now = Math.max(0, Date.now());
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

export function listDocuments(query?: string): AppDocument[] {
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

export function getDocumentById(documentId: string): AppDocument | undefined {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) return undefined;

  const state = loadState();
  return state.documents.find((doc) => doc.id === normalizedDocumentId);
}

export function updateDocumentContent(
  documentId: string,
  content: string,
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
    updatedAt: Math.max(Date.now(), existing.updatedAt),
  };
  state.documents[index] = updated;
  persistState(state);
  return updated;
}

export function updateDocumentTitle(
  documentId: string,
  title: string,
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
    updatedAt: Math.max(Date.now(), existing.updatedAt),
  };
  state.documents[index] = updated;
  persistState(state);
  return updated;
}

export function setDocumentLastDiffAt(
  documentId: string,
  timestamp: number,
): AppDocument | undefined {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (
    !isValidDocumentId(normalizedDocumentId) ||
    !Number.isFinite(timestamp) ||
    timestamp < 0
  ) {
    return undefined;
  }

  const state = loadState();
  const index = state.documents.findIndex((doc) => doc.id === normalizedDocumentId);
  if (index === -1) return undefined;
  const existing = state.documents[index];
  if (
    existing.lastDiffAt === timestamp ||
    (typeof existing.lastDiffAt === "number" && timestamp < existing.lastDiffAt)
  ) {
    return undefined;
  }
  const updated: AppDocument = {
    ...existing,
    lastDiffAt: timestamp,
  };
  state.documents[index] = updated;
  persistState(state);
  return updated;
}

export function setDocumentChatClearedAt(
  documentId: string,
  timestamp: number,
): AppDocument | undefined {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (
    !isValidDocumentId(normalizedDocumentId) ||
    !Number.isFinite(timestamp) ||
    timestamp < 0
  ) {
    return undefined;
  }

  const state = loadState();
  const index = state.documents.findIndex((doc) => doc.id === normalizedDocumentId);
  if (index === -1) return undefined;
  const existing = state.documents[index];
  if (
    existing.chatClearedAt === timestamp ||
    (typeof existing.chatClearedAt === "number" && timestamp < existing.chatClearedAt)
  ) {
    return undefined;
  }
  const updated: AppDocument = {
    ...existing,
    chatClearedAt: timestamp,
  };
  state.documents[index] = updated;
  persistState(state);
  return updated;
}

export function deleteDocument(documentId: string) {
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
  persistState({ documents: [] });
}

function normalizeDocumentTitle(value: unknown) {
  const normalizedValue = typeof value === "string" ? value.trim() : undefined;
  if (!normalizedValue || hasControlChars(normalizedValue)) {
    return "Untitled";
  }

  return normalizedValue;
}

