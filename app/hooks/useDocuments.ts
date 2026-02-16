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
    return listedDocuments.filter((document) =>
      safeHasDocumentAccess(
        document.id,
        normalizedCurrentUserEmail,
        document.ownerEmail,
      ),
    );
  }, [normalizedCurrentUserEmail, normalizedSearch, refreshCounter]);

  const create = useCallback(
    (title: unknown, ownerEmail?: unknown) => {
      const normalizedTitle = typeof title === "string" ? title : "";
      const normalizedOwnerEmail =
        typeof ownerEmail === "string" ? ownerEmail : undefined;
      const document = safeCreateDocument(normalizedTitle, normalizedOwnerEmail);
      if (!document) {
        return null;
      }
      refresh();
      return document;
    },
    [refresh],
  );

  const getById = useCallback((documentId: unknown): AppDocument | undefined => {
    const normalizedDocumentId =
      typeof documentId === "string" ? documentId : "";
    return safeGetDocumentById(normalizedDocumentId);
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
      if (updated) {
        refresh();
      }
      return updated;
    },
    [refresh],
  );

  const updateTitle = useCallback(
    (documentId: unknown, title: unknown) => {
      const normalizedDocumentId =
        typeof documentId === "string" ? documentId : "";
      const normalizedTitle = typeof title === "string" ? title : "";
      const updated = safeUpdateDocumentTitle(normalizedDocumentId, normalizedTitle);
      if (updated) {
        refresh();
      }
      return updated;
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
      if (updated) {
        refresh();
      }
      return updated;
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
