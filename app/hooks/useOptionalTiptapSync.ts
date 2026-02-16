"use client";

import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";

import { api } from "@/convex/_generated/api";

export function useOptionalTiptapSync(documentId: string) {
  const sync = useTiptapSync(api.prosemirrorSync as never, documentId, {
    snapshotDebounceMs: 1000,
  });

  return sync;
}
