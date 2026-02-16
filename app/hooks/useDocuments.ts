"use client";

import { useCallback, useMemo, useState } from "react";

import {
  createDocument,
  deleteDocument,
  getDocumentById,
  listDocuments,
  setDocumentChatClearedAt,
  updateDocumentTitle,
  updateDocumentContent,
} from "@/lib/documents/store";
import { hasDocumentAccess } from "@/lib/permissions/store";
import type { AppDocument } from "@/lib/types";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";
import { normalizeEmailOrUndefined } from "@/lib/user/email";
import { hasControlChars } from "@/lib/validators/controlChars";
import { isValidEmail } from "@/lib/validators/email";

export function useDocuments(
  search?: unknown,
  currentUserEmail: unknown = DEFAULT_LOCAL_USER_EMAIL,
) {
  const normalizedCurrentUserEmailCandidate =
    normalizeEmailOrUndefined(currentUserEmail);
  const normalizedCurrentUserEmail =
    normalizedCurrentUserEmailCandidate &&
    isValidEmail(normalizedCurrentUserEmailCandidate)
      ? normalizedCurrentUserEmailCandidate
      : DEFAULT_LOCAL_USER_EMAIL;
  const [refreshCounter, setRefreshCounter] = useState(0);
  const normalizedSearch = typeof search === "string" ? search : undefined;

  const refresh = useCallback(() => {
    setRefreshCounter((value) => value + 1);
  }, []);

  const documents = useMemo(() => {
    void refreshCounter;
    const listedDocuments = safeListDocuments(normalizedSearch);
    return listedDocuments.flatMap((document) => {
      const normalizedDocument = safeNormalizeListedDocument(document);
      if (!normalizedDocument) {
        return [];
      }

      return safeHasDocumentAccess(
        normalizedDocument.id,
        normalizedCurrentUserEmail,
        normalizedDocument.ownerEmail,
      )
        ? [normalizedDocument]
        : [];
    });
  }, [normalizedCurrentUserEmail, normalizedSearch, refreshCounter]);

  const create = useCallback(
    (title: unknown, ownerEmail?: unknown) => {
      const normalizedTitle = typeof title === "string" ? title : "";
      const normalizedOwnerEmail =
        typeof ownerEmail === "string" ? ownerEmail : undefined;
      const createdDocument = safeCreateDocument(normalizedTitle, normalizedOwnerEmail);
      const normalizedDocument = safeNormalizeListedDocument(createdDocument);
      if (!normalizedDocument) {
        return null;
      }
      refresh();
      return normalizedDocument;
    },
    [refresh],
  );

  const getById = useCallback((documentId: unknown): AppDocument | undefined => {
    const normalizedDocumentId =
      typeof documentId === "string" ? documentId : "";
    const document = safeGetDocumentById(normalizedDocumentId);
    return safeNormalizeListedDocument(document) ?? undefined;
  }, []);

  const updateContent = useCallback(
    (documentId: unknown, content: unknown) => {
      const normalizedDocumentId =
        typeof documentId === "string" ? documentId : "";
      const normalizedContent = typeof content === "string" ? content : "";
      const updated = safeUpdateDocumentContent(
        normalizedDocumentId,
        normalizedContent,
      );
      const normalizedUpdatedDocument = safeNormalizeListedDocument(updated);
      if (normalizedUpdatedDocument) {
        refresh();
      }
      return normalizedUpdatedDocument ?? undefined;
    },
    [refresh],
  );

  const updateTitle = useCallback(
    (documentId: unknown, title: unknown) => {
      const normalizedDocumentId =
        typeof documentId === "string" ? documentId : "";
      const normalizedTitle = typeof title === "string" ? title : "";
      const updatedDocument = safeUpdateDocumentTitle(normalizedDocumentId, normalizedTitle);
      const normalizedUpdatedDocument = safeNormalizeListedDocument(updatedDocument);
      if (normalizedUpdatedDocument) {
        refresh();
      }
      return normalizedUpdatedDocument ?? undefined;
    },
    [refresh],
  );

  const setChatClearedAt = useCallback(
    (documentId: unknown, timestamp: unknown) => {
      const normalizedDocumentId =
        typeof documentId === "string" ? documentId : "";
      const normalizedTimestamp =
        typeof timestamp === "number" ? timestamp : Number.NaN;
      const updated = safeSetDocumentChatClearedAt(
        normalizedDocumentId,
        normalizedTimestamp,
      );
      const normalizedUpdatedDocument = safeNormalizeListedDocument(updated);
      if (normalizedUpdatedDocument) {
        refresh();
      }
      return normalizedUpdatedDocument ?? undefined;
    },
    [refresh],
  );

  const remove = useCallback(
    (documentId: unknown) => {
      const normalizedDocumentId =
        typeof documentId === "string" ? documentId : "";
      const removed = safeDeleteDocument(normalizedDocumentId);
      if (removed) {
        refresh();
      }
      return removed;
    },
    [refresh],
  );

  return {
    documents,
    create,
    getById,
    updateTitle,
    updateContent,
    setChatClearedAt,
    remove,
    refresh,
  };
}

function safeListDocuments(query?: string) {
  try {
    return listDocuments(query);
  } catch {
    return [];
  }
}

function safeHasDocumentAccess(
  documentId: string,
  email: string,
  ownerEmail?: string,
) {
  try {
    return hasDocumentAccess(documentId, email, ownerEmail);
  } catch {
    return false;
  }
}

function safeCreateDocument(title: string, ownerEmail?: string) {
  try {
    return createDocument(title, ownerEmail);
  } catch {
    return null;
  }
}

function safeGetDocumentById(documentId: string) {
  try {
    return getDocumentById(documentId);
  } catch {
    return undefined;
  }
}

function safeUpdateDocumentContent(documentId: string, content: string) {
  try {
    return updateDocumentContent(documentId, content);
  } catch {
    return undefined;
  }
}

function safeUpdateDocumentTitle(documentId: string, title: string) {
  try {
    return updateDocumentTitle(documentId, title);
  } catch {
    return undefined;
  }
}

function safeSetDocumentChatClearedAt(documentId: string, timestamp: number) {
  try {
    return setDocumentChatClearedAt(documentId, timestamp);
  } catch {
    return undefined;
  }
}

function safeDeleteDocument(documentId: string) {
  try {
    return deleteDocument(documentId);
  } catch {
    return false;
  }
}

function safeNormalizeListedDocument(document: unknown): AppDocument | null {
  if (!document || typeof document !== "object") {
    return null;
  }

  const id = safeReadObjectField(document, "id");
  const normalizedId = typeof id === "string" ? id.trim() : "";
  if (!normalizedId || hasControlChars(normalizedId)) {
    return null;
  }

  const title = safeReadObjectField(document, "title");
  const content = safeReadObjectField(document, "content");
  const ownerEmail = safeReadObjectField(document, "ownerEmail");
  const createdAt = safeReadObjectField(document, "createdAt");
  const updatedAt = safeReadObjectField(document, "updatedAt");
  const lastDiffAt = safeReadObjectField(document, "lastDiffAt");
  const chatClearedAt = safeReadObjectField(document, "chatClearedAt");
  const aiLockedBy = safeReadObjectField(document, "aiLockedBy");
  const aiLockedAt = safeReadObjectField(document, "aiLockedAt");

  const normalizedCreatedAt =
    typeof createdAt === "number" && Number.isFinite(createdAt) && createdAt >= 0
      ? createdAt
      : 0;
  const normalizedUpdatedAt =
    typeof updatedAt === "number" && Number.isFinite(updatedAt) && updatedAt >= 0
      ? Math.max(updatedAt, normalizedCreatedAt)
      : normalizedCreatedAt;

  return {
    id: normalizedId,
    title:
      typeof title === "string" && title.trim().length > 0
        ? title
        : "Untitled",
    content:
      typeof content === "string"
        ? content
        : JSON.stringify({
            type: "doc",
            content: [{ type: "paragraph" }],
          }),
    ownerEmail:
      typeof ownerEmail === "string" && ownerEmail.trim().length > 0
        ? ownerEmail.trim()
        : DEFAULT_LOCAL_USER_EMAIL,
    createdAt: normalizedCreatedAt,
    updatedAt: normalizedUpdatedAt,
    lastDiffAt:
      typeof lastDiffAt === "number" && Number.isFinite(lastDiffAt) && lastDiffAt >= 0
        ? lastDiffAt
        : undefined,
    chatClearedAt:
      typeof chatClearedAt === "number" &&
      Number.isFinite(chatClearedAt) &&
      chatClearedAt >= 0
        ? chatClearedAt
        : undefined,
    aiLockedBy:
      typeof aiLockedBy === "string" && aiLockedBy.trim().length > 0
        ? aiLockedBy.trim()
        : undefined,
    aiLockedAt:
      typeof aiLockedAt === "number" && Number.isFinite(aiLockedAt) && aiLockedAt >= 0
        ? aiLockedAt
        : undefined,
  };
}

function safeReadObjectField(value: unknown, key: string) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  try {
    return (value as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}
