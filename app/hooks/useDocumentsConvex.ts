"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";
import type { AppDocument, Role } from "@/lib/types";

type DocumentWithRole = AppDocument & { role?: Role };

export function useDocumentsConvex(
  _search?: unknown,
  currentUserEmail: unknown = DEFAULT_LOCAL_USER_EMAIL,
) {
  const createMutation = useMutation(api.documents.create);
  const updateContentMutation = useMutation(api.documents.updateContent);
  const updateTitleMutation = useMutation(api.documents.updateTitle);
  const setChatClearedAtMutation = useMutation(api.documents.setChatClearedAt);
  const removeMutation = useMutation(api.documents.remove);
  const listedDocumentsResult = useQuery(api.documents.list, {});
  const [documentOverrides, setDocumentOverrides] = useState<
    Record<string, DocumentWithRole | null>
  >({});

  const normalizedCurrentUserEmail =
    typeof currentUserEmail === "string" && currentUserEmail.trim().length > 0
      ? currentUserEmail.trim()
      : DEFAULT_LOCAL_USER_EMAIL;

  const refresh = useCallback(() => {
    return;
  }, []);

  const documents = useMemo(() => {
    const listedDocuments = Array.isArray(listedDocumentsResult)
      ? listedDocumentsResult
      : [];
    const remoteDocuments = normalizeConvexDocuments(
      listedDocuments,
      normalizedCurrentUserEmail,
    );
    const remoteById = new Map(remoteDocuments.map((document) => [document.id, document]));
    for (const [documentId, override] of Object.entries(documentOverrides)) {
      if (override === null) {
        remoteById.delete(documentId);
        continue;
      }
      remoteById.set(documentId, override);
    }
    return Array.from(remoteById.values()).sort((a, b) =>
      b.updatedAt === a.updatedAt
        ? a.id.localeCompare(b.id)
        : b.updatedAt - a.updatedAt,
    );
  }, [documentOverrides, listedDocumentsResult, normalizedCurrentUserEmail]);

  const create = useCallback(
    async (title: unknown) => {
      const normalizedTitle = typeof title === "string" ? title.trim() : "";
      try {
        const createdId = await createMutation({
          title: normalizedTitle || "Untitled",
        });
        const now = safeNow();
        const created: DocumentWithRole = {
          id: String(createdId),
          title: normalizedTitle || "Untitled",
          content: JSON.stringify({
            type: "doc",
            content: [{ type: "paragraph" }],
          }),
          ownerEmail: normalizedCurrentUserEmail,
          createdAt: now,
          updatedAt: now,
          role: "owner",
        };
        setDocumentOverrides((current) => ({ ...current, [created.id]: created }));
        return created;
      } catch {
        return null;
      }
    },
    [createMutation, normalizedCurrentUserEmail],
  );

  const getById = useCallback(
    (documentId: unknown): (AppDocument & { role?: Role }) | undefined => {
      const normalizedDocumentId =
        typeof documentId === "string" ? documentId.trim() : "";
      return documents.find((document) => document.id === normalizedDocumentId);
    },
    [documents],
  );

  const updateContent = useCallback(
    (documentId: unknown, content: unknown) => {
      const normalizedDocumentId =
        typeof documentId === "string" ? documentId.trim() : "";
      const normalizedContent = typeof content === "string" ? content : "";
      if (!normalizedDocumentId || !normalizedContent) {
        return undefined;
      }

      const now = safeNow();
      setDocumentOverrides((current) => {
        const existingDocument = documents.find(
          (document) => document.id === normalizedDocumentId,
        );
        if (!existingDocument) {
          return current;
        }
        return {
          ...current,
          [normalizedDocumentId]: {
            ...existingDocument,
            content: normalizedContent,
            updatedAt: now,
          },
        };
      });
      void safeRun(async () => {
        await updateContentMutation({
          documentId: normalizedDocumentId as never,
          content: normalizedContent,
        });
      });
      return undefined;
    },
    [documents, updateContentMutation],
  );

  const updateTitle = useCallback(
    (documentId: unknown, title: unknown) => {
      const normalizedDocumentId =
        typeof documentId === "string" ? documentId.trim() : "";
      const normalizedTitle = typeof title === "string" ? title.trim() : "";
      if (!normalizedDocumentId || !normalizedTitle) {
        return undefined;
      }

      const now = safeNow();
      setDocumentOverrides((current) => {
        const existingDocument = documents.find(
          (document) => document.id === normalizedDocumentId,
        );
        if (!existingDocument) {
          return current;
        }
        return {
          ...current,
          [normalizedDocumentId]: {
            ...existingDocument,
            title: normalizedTitle,
            updatedAt: now,
          },
        };
      });
      void safeRun(async () => {
        await updateTitleMutation({
          documentId: normalizedDocumentId as never,
          title: normalizedTitle,
        });
      });
      return undefined;
    },
    [documents, updateTitleMutation],
  );

  const setChatClearedAt = useCallback(
    (documentId: unknown, timestamp: unknown) => {
      const normalizedDocumentId =
        typeof documentId === "string" ? documentId.trim() : "";
      const normalizedTimestamp =
        typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp >= 0
          ? timestamp
          : undefined;
      if (!normalizedDocumentId || normalizedTimestamp === undefined) {
        return undefined;
      }
      setDocumentOverrides((current) => {
        const existingDocument = documents.find(
          (document) => document.id === normalizedDocumentId,
        );
        if (!existingDocument) {
          return current;
        }
        return {
          ...current,
          [normalizedDocumentId]: {
            ...existingDocument,
            chatClearedAt: normalizedTimestamp,
          },
        };
      });
      void safeRun(async () => {
        await setChatClearedAtMutation({
          documentId: normalizedDocumentId as never,
          chatClearedAt: normalizedTimestamp,
        });
      });
      return undefined;
    },
    [documents, setChatClearedAtMutation],
  );

  const remove = useCallback(
    (documentId: unknown) => {
      const normalizedDocumentId =
        typeof documentId === "string" ? documentId.trim() : "";
      if (!normalizedDocumentId) {
        return false;
      }

      const removed = documents.some((document) => document.id === normalizedDocumentId);
      if (!removed) {
        return false;
      }
      setDocumentOverrides((current) => ({ ...current, [normalizedDocumentId]: null }));

      void safeRun(async () => {
        await removeMutation({
          documentId: normalizedDocumentId as never,
        });
      });
      return true;
    },
    [documents, removeMutation],
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

function normalizeConvexDocuments(
  documents: unknown,
  fallbackOwnerEmail: string,
): DocumentWithRole[] {
  if (!Array.isArray(documents)) {
    return [];
  }

  return documents.flatMap((document) => {
    if (!document || typeof document !== "object") {
      return [];
    }

    const id = readField(document, "_id");
    const title = readField(document, "title");
    const content = readField(document, "content");
    const createdAt = readField(document, "_creationTime");
    const updatedAt = readField(document, "updatedAt");
    const lastDiffAt = readField(document, "lastDiffAt");
    const chatClearedAt = readField(document, "chatClearedAt");
    const role = readField(document, "role");

    if (typeof id !== "string" || id.trim().length === 0) {
      return [];
    }

    const normalizedCreatedAt =
      typeof createdAt === "number" && Number.isFinite(createdAt) && createdAt >= 0
        ? createdAt
        : 0;
    const normalizedUpdatedAt =
      typeof updatedAt === "number" && Number.isFinite(updatedAt) && updatedAt >= 0
        ? Math.max(updatedAt, normalizedCreatedAt)
        : normalizedCreatedAt;

    return [
      {
        id,
        title:
          typeof title === "string" && title.trim().length > 0
            ? title
            : "Untitled",
        content:
          typeof content === "string"
            ? content
            : JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
        ownerEmail: fallbackOwnerEmail,
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
        role:
          role === "owner" || role === "editor" || role === "commenter" || role === "viewer"
            ? role
            : "viewer",
      } satisfies DocumentWithRole,
    ];
  });
}

function readField(value: unknown, key: string) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  try {
    return (value as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

async function safeRun(callback: () => Promise<unknown>) {
  try {
    await callback();
  } catch {
    return;
  }
}

function safeNow() {
  try {
    return Math.max(0, Date.now());
  } catch {
    return 0;
  }
}
