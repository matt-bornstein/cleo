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
    return parsed.documents ? parsed : { documents: [] };
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

export function createDocument(title: string): AppDocument {
  const now = Date.now();
  const normalizedTitle = title.trim() || "Untitled";
  const state = loadState();
  const document: AppDocument = {
    id: crypto.randomUUID(),
    title: normalizedTitle,
    content: EMPTY_EDITOR_DOC,
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

export function resetDocumentsForTests() {
  persistState({ documents: [] });
}

