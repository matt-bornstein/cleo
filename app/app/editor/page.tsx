"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useDocuments } from "@/hooks/useDocuments";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";
import { normalizeEmailOrUndefined } from "@/lib/user/email";
import { hasControlChars } from "@/lib/validators/controlChars";

export default function EditorIndexPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const currentUserEmail =
    normalizeEmailOrUndefined(settings.userEmail) ?? DEFAULT_LOCAL_USER_EMAIL;
  const { documents, create } = useDocuments(undefined, currentUserEmail);
  const existingDocumentId = Array.isArray(documents)
    ? documents
        .map((document) => normalizeDocumentId(document?.id))
        .find((documentId) => !!documentId)
    : undefined;

  const handleContinue = () => {
    if (existingDocumentId) {
      router.push(`/editor/${existingDocumentId}`);
      return;
    }

    const document = create("Untitled", currentUserEmail);
    const nextDocumentId = normalizeDocumentId(
      document &&
        typeof document === "object" &&
        "id" in document
        ? (document as { id?: unknown }).id
        : undefined,
    );
    router.push(nextDocumentId ? `/editor/${nextDocumentId}` : "/editor");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Collaborative Rich Text Editor
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This route creates or opens your latest local document shell.
        </p>
        <Button className="mt-6" onClick={handleContinue}>
          Open editor
        </Button>
      </section>
    </main>
  );
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
