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

export function useDocuments(search?: string, currentUserEmail = "me@local.dev") {
  const [refreshCounter, setRefreshCounter] = useState(0);

  const refresh = useCallback(() => {
    setRefreshCounter((value) => value + 1);
  }, []);

  const documents = useMemo(() => {
    void refreshCounter;
    return listDocuments(search).filter((document) =>
      hasDocumentAccess(document.id, currentUserEmail, document.ownerEmail),
    );
  }, [currentUserEmail, refreshCounter, search]);

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
      refresh();
      return updated;
    },
    [refresh],
  );

  const updateTitle = useCallback(
    (documentId: string, title: string) => {
      const updated = updateDocumentTitle(documentId, title);
      refresh();
      return updated;
    },
    [refresh],
  );

  const setChatClearedAt = useCallback(
    (documentId: string, timestamp: number) => {
      const updated = setDocumentChatClearedAt(documentId, timestamp);
      refresh();
      return updated;
    },
    [refresh],
  );

  const remove = useCallback(
    (documentId: string) => {
      const removed = deleteDocument(documentId);
      refresh();
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
