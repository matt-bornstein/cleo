"use client";

import { useCallback, useMemo, useState } from "react";

import {
  createDocument,
  deleteDocument,
  getDocumentById,
  listDocuments,
  setDocumentChatClearedAt,
  updateDocumentContent,
} from "@/lib/documents/store";
import type { AppDocument } from "@/lib/types";

export function useDocuments(search?: string) {
  const [refreshCounter, setRefreshCounter] = useState(0);

  const refresh = useCallback(() => {
    setRefreshCounter((value) => value + 1);
  }, []);

  const documents = useMemo(() => {
    void refreshCounter;
    return listDocuments(search);
  }, [refreshCounter, search]);

  const create = useCallback(
    (title: string) => {
      const document = createDocument(title);
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
    updateContent,
    setChatClearedAt,
    remove,
    refresh,
  };
}
