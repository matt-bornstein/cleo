"use client";

import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";

import { api } from "@/convex/_generated/api";

export function useOptionalTiptapSync(documentId: string) {
  const isConvexEnabled = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const sync = useTiptapSync(api.prosemirrorSync as never, documentId, {
    snapshotDebounceMs: 1000,
  });

  if (!isConvexEnabled) {
    return {
      enabled: false,
      isLoading: false,
      extension: null,
      initialContent: null,
      create: () => Promise.resolve(),
    };
  }

  return {
    enabled: true,
    ...sync,
  };
}
