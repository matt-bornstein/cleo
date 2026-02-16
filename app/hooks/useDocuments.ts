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
    (title: unknown, ownerEmail?: unknown) => {
      const normalizedTitle = typeof title === "string" ? title : "";
      const normalizedOwnerEmail =
        typeof ownerEmail === "string" ? ownerEmail : undefined;
      const document = createDocument(normalizedTitle, normalizedOwnerEmail);
      refresh();
      return document;
    },
    [refresh],
  );

  const getById = useCallback((documentId: unknown): AppDocument | undefined => {
    const normalizedDocumentId =
      typeof documentId === "string" ? documentId : "";
    return getDocumentById(normalizedDocumentId);
  }, []);

  const updateContent = useCallback(
    (documentId: unknown, content: unknown) => {
      const normalizedDocumentId =
        typeof documentId === "string" ? documentId : "";
      const normalizedContent = typeof content === "string" ? content : "";
      const updated = updateDocumentContent(
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
      const updated = updateDocumentTitle(normalizedDocumentId, normalizedTitle);
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
      const updated = setDocumentChatClearedAt(
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
      const removed = deleteDocument(normalizedDocumentId);
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
