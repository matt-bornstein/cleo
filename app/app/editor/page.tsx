"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useDocuments } from "@/hooks/useDocuments";

export default function EditorIndexPage() {
  const router = useRouter();
  const { documents, create } = useDocuments();

  const handleContinue = () => {
    if (documents.length > 0) {
      router.push(`/editor/${documents[0].id}`);
      return;
    }

    const document = create("Untitled");
    router.push(`/editor/${document.id}`);
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
