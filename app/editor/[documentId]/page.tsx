"use client";

import { use, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Toolbar } from "@/components/layout/Toolbar";
import { EditorLayout } from "@/components/layout/EditorLayout";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { AIPanel } from "@/components/ai/AIPanel";
import { CommentsSidebar } from "@/components/comments/CommentsSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function EditorPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = use(params);
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const router = useRouter();
  const [showComments, setShowComments] = useState(false);

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
        documentContent={document.content}
        onToggleComments={() => setShowComments(!showComments)}
        showComments={showComments}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Editor panel - takes remaining space */}
        <div className="flex flex-1 flex-col border-r">
          <EditorPanel
            documentId={document._id}
            initialContent={document.content}
          />
        </div>

        {/* Right side: AI Panel + Comments */}
        <div className="flex w-1/3 flex-col">
          {showComments ? (
            <div className="flex h-full flex-col">
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-1/2 border-b">
                  <CommentsSidebar documentId={document._id} />
                </ScrollArea>
                <div className="h-1/2">
                  <AIPanel documentId={document._id} />
                </div>
              </div>
            </div>
          ) : (
            <AIPanel documentId={document._id} />
          )}
        </div>
      </div>
    </div>
  );
}
