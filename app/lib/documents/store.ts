import type { AppDocument } from "@/lib/types";

const STORAGE_KEY = "plan00.documents.v1";

type DocumentStoreState = {
  documents: AppDocument[];
};

const EMPTY_EDITOR_DOC = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
});

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

    return {
      documents: parsed.documents.map((doc) => ({
        ...doc,
        ownerEmail: doc.ownerEmail ?? "me@local.dev",
      })),
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

export function createDocument(title: string, ownerEmail = "me@local.dev"): AppDocument {
  const now = Date.now();
  const normalizedTitle = title.trim() || "Untitled";
  const state = loadState();
  const document: AppDocument = {
    id: crypto.randomUUID(),
    title: normalizedTitle,
    content: EMPTY_EDITOR_DOC,
    ownerEmail: ownerEmail.trim().toLowerCase(),
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
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDocumentById(documentId: string): AppDocument | undefined {
  const state = loadState();
  return state.documents.find((doc) => doc.id === documentId);
}

export function updateDocumentContent(
  documentId: string,
  content: string,
): AppDocument | undefined {
  const state = loadState();
  const index = state.documents.findIndex((doc) => doc.id === documentId);
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
  const state = loadState();
  const index = state.documents.findIndex((doc) => doc.id === documentId);
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
  const state = loadState();
  const index = state.documents.findIndex((doc) => doc.id === documentId);
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
  const state = loadState();
  const index = state.documents.findIndex((doc) => doc.id === documentId);
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
  const state = loadState();
  const beforeCount = state.documents.length;
  state.documents = state.documents.filter((doc) => doc.id !== documentId);
  persistState(state);
  return state.documents.length !== beforeCount;
}

export function resetDocumentsForTests() {
  persistState({ documents: [] });
}

