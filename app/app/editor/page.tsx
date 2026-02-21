"use client";

import { useRouter } from "next/navigation";
import { useAuthToken } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex/react";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useDocumentsConvex } from "@/hooks/useDocumentsConvex";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";
import { normalizeEmailOrUndefined } from "@/lib/user/email";
import { hasControlChars } from "@/lib/validators/controlChars";

export default function EditorIndexPage() {
  const router = useRouter();
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const authToken = useAuthToken();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const { settings } = useSettings();
  const currentUserEmail =
    normalizeEmailOrUndefined(settings.userEmail) ?? DEFAULT_LOCAL_USER_EMAIL;
  const { documents, create } = useDocumentsConvex(undefined, currentUserEmail);
  const existingDocumentId = Array.isArray(documents)
    ? documents
        .map((document) => normalizeDocumentId(document?.id))
        .find((documentId) => !!documentId)
    : undefined;

  const handleContinue = async () => {
    if (isAuthLoading || currentUser === undefined) {
      return;
    }
    if (!isAuthenticated || authToken === null || currentUser === null) {
      safeNavigate(router, "/sign-in?next=%2Feditor");
      return;
    }

    if (existingDocumentId) {
      safeNavigate(router, `/editor/${existingDocumentId}`);
      return;
    }

    const document = await create("Untitled");
    const nextDocumentId = normalizeDocumentId(readCreatedDocumentId(document));
    safeNavigate(router, nextDocumentId ? `/editor/${nextDocumentId}` : "/editor");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Collaborative Rich Text Editor
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Open your latest Convex-backed document, or create a new one.
        </p>
        <Button
          className="mt-6"
          disabled={isAuthLoading || authToken === null || currentUser === undefined}
          onClick={() => {
            void handleContinue();
          }}
        >
          {isAuthLoading || authToken === null || currentUser === undefined
            ? "Checking session..."
            : "Open editor"}
        </Button>
      </section>
    </main>
  );
}

function safeNavigate(router: unknown, path: string) {
  if (!router || typeof router !== "object" || !("push" in router)) {
    return;
  }

  try {
    const push = (router as { push?: unknown }).push;
    if (typeof push === "function") {
      push(path);
    }
  } catch {
    return;
  }
}

function normalizeDocumentId(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized || hasControlChars(normalized)) {
    return undefined;
  }

  return normalized;
}

function readCreatedDocumentId(document: unknown) {
  if (!document || typeof document !== "object") {
    return undefined;
  }

  try {
    return (document as { id?: unknown }).id;
  } catch {
    return undefined;
  }
}
