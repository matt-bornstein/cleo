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
    return listDocuments(normalizedSearch).filter((document) =>
      hasDocumentAccess(
        document.id,
        normalizedCurrentUserEmail,
        document.ownerEmail,
      ),
    );
  }, [normalizedCurrentUserEmail, normalizedSearch, refreshCounter]);

  const create = useCallback(
    (title: string, ownerEmail?: string) => {
      const document = createDocument(title, ownerEmail);
      refresh();
      return document;
    },
    [refresh],
  );

  const getById = useCallback((documentId: string): AppDocument | undefined => {
    return getDocumentById(documentId);
  }, []);

  const updateContent = useCallback(
    (documentId: string, content: string) => {
      const updated = updateDocumentContent(documentId, content);
      if (updated) {
        refresh();
      }
      return updated;
    },
    [refresh],
  );

  const updateTitle = useCallback(
    (documentId: string, title: string) => {
      const updated = updateDocumentTitle(documentId, title);
      if (updated) {
        refresh();
      }
      return updated;
    },
    [refresh],
  );

  const setChatClearedAt = useCallback(
    (documentId: string, timestamp: number) => {
      const updated = setDocumentChatClearedAt(documentId, timestamp);
      if (updated) {
        refresh();
      }
      return updated;
    },
    [refresh],
  );

  const remove = useCallback(
    (documentId: string) => {
      const removed = deleteDocument(documentId);
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
