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
  const normalizedDocuments = Array.isArray(documents)
    ? documents.filter((document) => {
        const normalizedId =
          typeof document?.id === "string" ? document.id.trim() : undefined;
        return !!normalizedId && !hasControlChars(normalizedId);
      })
    : [];

  const handleContinue = () => {
    const existingDocumentId = normalizedDocuments[0]?.id;
    if (
      typeof existingDocumentId === "string" &&
      existingDocumentId.trim().length > 0
    ) {
      router.push(`/editor/${existingDocumentId}`);
      return;
    }

    const document = create("Untitled", currentUserEmail);
    const nextDocumentId =
      document &&
      typeof document === "object" &&
      typeof (document as { id?: unknown }).id === "string" &&
      (document as { id: string }).id.trim().length > 0 &&
      !hasControlChars((document as { id: string }).id.trim())
        ? (document as { id: string }).id.trim()
        : undefined;
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
