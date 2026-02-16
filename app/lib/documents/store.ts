import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import { isValidDocumentContentJson } from "@/lib/ai/documentContent";
import type { AppDocument } from "@/lib/types";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";
import { normalizeEmailOrFallback } from "@/lib/user/email";

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

    const sanitizedDocuments = parsed.documents.flatMap((doc) => {
        const normalizedDocumentId = normalizeDocumentId(doc.id);
        if (!isValidDocumentId(normalizedDocumentId)) {
          return [];
        }

        const normalizedTitle =
          typeof doc.title === "string" && doc.title.trim().length > 0
            ? doc.title.trim()
            : "Untitled";
        const now = Date.now();
        const normalizedCreatedAt =
          typeof doc.createdAt === "number" && Number.isFinite(doc.createdAt)
            ? doc.createdAt
            : now;
        const normalizedUpdatedAt =
          typeof doc.updatedAt === "number" && Number.isFinite(doc.updatedAt)
            ? Math.max(doc.updatedAt, normalizedCreatedAt)
            : normalizedCreatedAt;

        return [
          {
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
              typeof doc.lastDiffAt === "number" && Number.isFinite(doc.lastDiffAt)
                ? doc.lastDiffAt
                : undefined,
            chatClearedAt:
              typeof doc.chatClearedAt === "number" && Number.isFinite(doc.chatClearedAt)
                ? doc.chatClearedAt
                : undefined,
          },
        ];
      });

    const dedupedByDocumentId = new Map<string, AppDocument>();
    for (const document of sanitizedDocuments) {
      dedupedByDocumentId.set(document.id, document);
    }

    return {
      documents: Array.from(dedupedByDocumentId.values()),
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
  return normalizeEmailOrFallback(ownerEmail, DEFAULT_OWNER_EMAIL);
}

export function createDocument(title: string, ownerEmail = DEFAULT_OWNER_EMAIL): AppDocument {
  const now = Date.now();
  const normalizedTitle = title.trim() || "Untitled";
  const state = loadState();
  const document: AppDocument = {
    id: crypto.randomUUID(),
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
  const normalizedQuery = query?.trim().toLowerCase();

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
  const updated: AppDocument = {
    ...existing,
    content,
    updatedAt: Date.now(),
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

  const normalizedTitle = title.trim() || "Untitled";
  const updated: AppDocument = {
    ...state.documents[index],
    title: normalizedTitle,
    updatedAt: Date.now(),
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
    !Number.isFinite(timestamp)
  ) {
    return undefined;
  }

  const state = loadState();
  const index = state.documents.findIndex((doc) => doc.id === normalizedDocumentId);
  if (index === -1) return undefined;
  const updated: AppDocument = {
    ...state.documents[index],
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
    !Number.isFinite(timestamp)
  ) {
    return undefined;
  }

  const state = loadState();
  const index = state.documents.findIndex((doc) => doc.id === normalizedDocumentId);
  if (index === -1) return undefined;
  const updated: AppDocument = {
    ...state.documents[index],
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
  persistState(state);
  return state.documents.length !== beforeCount;
}

export function resetDocumentsForTests() {
  persistState({ documents: [] });
}

