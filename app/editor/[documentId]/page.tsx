"use client";

import { use } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Toolbar } from "@/components/layout/Toolbar";
import { EditorLayout } from "@/components/layout/EditorLayout";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { AIPanel } from "@/components/ai/AIPanel";

export default function EditorPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = use(params);
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const router = useRouter();

  const document = useQuery(
    api.documents.get,
    isAuthenticated ? { id: documentId as Id<"documents"> } : "skip"
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/sign-in");
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (document === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading document...</p>
      </div>
    );
  }

  if (document === null) {
    return (
      <div className="flex min-h-screen flex-col">
        <Toolbar />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">
            Document not found or you don&apos;t have access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <Toolbar
        documentId={document._id}
        documentTitle={document.title}
      />
      <EditorLayout
        editor={
          <EditorPanel
            documentId={document._id}
            initialContent={document.content}
          />
        }
        aiPanel={<AIPanel documentId={document._id} />}
      />
    </div>
  );
}
