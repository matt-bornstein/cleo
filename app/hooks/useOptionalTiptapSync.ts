"use client";

import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";

import { api } from "@/convex/_generated/api";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";

const FALLBACK_SYNC_DOCUMENT_ID = "__invalid-document-id__";

export function normalizeSyncDocumentId(documentId: unknown) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  return isValidDocumentId(normalizedDocumentId)
    ? normalizedDocumentId
    : FALLBACK_SYNC_DOCUMENT_ID;
}

export function useOptionalTiptapSync(documentId: unknown) {
  const sync = useTiptapSync(
    api.prosemirrorSync as never,
    normalizeSyncDocumentId(documentId),
    {
    snapshotDebounceMs: 1000,
    },
  );

  return sync;
}
