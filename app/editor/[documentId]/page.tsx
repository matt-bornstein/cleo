"use client";

import { use, useState, useEffect } from "react";
import { Authenticated, Unauthenticated, AuthLoading, useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Toolbar } from "@/components/layout/Toolbar";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { AIPanel } from "@/components/ai/AIPanel";
import { CommentsSidebar } from "@/components/comments/CommentsSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  EditorContextProvider,
  useEditorContext,
} from "@/components/editor/EditorContext";
import { Bot, X } from "lucide-react";
import { Input } from "@/components/ui/input";

function RedirectToSignIn() {
  const router = useRouter();
  useEffect(() => { router.push("/sign-in"); }, [router]);
  return null;
}

function AuthenticatedEditorPage({ documentId }: { documentId: Id<"documents"> }) {
  const document = useQuery(api.documents.get, { id: documentId });

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
    <EditorContextProvider>
      <EditorPageContent
        document={document}
        documentId={documentId}
      />
    </EditorContextProvider>
  );
}

export default function EditorPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = use(params);

  return (
    <>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <RedirectToSignIn />
      </Unauthenticated>
      <Authenticated>
        <AuthenticatedEditorPage documentId={documentId as Id<"documents">} />
      </Authenticated>
    </>
  );
}

function EditorPageContent({
  document,
  documentId,
}: {
  document: {
    _id: Id<"documents">;
    title: string;
    content: string;
    myRole: string;
  };
  documentId: Id<"documents">;
}) {
  const [showComments, setShowComments] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(document.title || "");
  const { getEditorHtml } = useEditorContext();
  const updateTitle = useMutation(api.documents.updateTitle);

  const handleTitleSave = async () => {
    if (editTitle.trim()) {
      await updateTitle({ id: document._id, title: editTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="flex h-screen flex-col">
      <Toolbar
        documentId={document._id}
        documentTitle={document.title}
        documentContent={document.content}
        onToggleComments={() => setShowComments(!showComments)}
        showComments={showComments}
        getEditorHtml={getEditorHtml}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Editor panel — full width on mobile, 2/3 on desktop */}
        <div className="flex min-h-0 flex-1 flex-col lg:border-r">
          <div className="flex h-11 items-center border-b px-4">
            {isEditingTitle ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSave();
                  if (e.key === "Escape") setIsEditingTitle(false);
                }}
                className="h-8 max-w-md text-lg font-semibold"
                autoFocus
              />
            ) : (
              <button
                className="text-lg font-semibold text-foreground hover:text-muted-foreground"
                onClick={() => {
                  setEditTitle(document.title || "");
                  setIsEditingTitle(true);
                }}
              >
                {document.title || "Untitled"}
              </button>
            )}
          </div>
          <EditorPanel
            documentId={document._id}
            initialContent={document.content}
          />
        </div>

        {/* Right side panel — hidden on mobile, shown on desktop */}
        <div className="hidden w-1/3 flex-col lg:flex">
          {showComments ? (
            <div className="flex h-full flex-col">
              <ScrollArea className="h-1/2 border-b">
                <CommentsSidebar documentId={document._id} />
              </ScrollArea>
              <div className="h-1/2">
                <AIPanel documentId={document._id} />
              </div>
            </div>
          ) : (
            <AIPanel documentId={document._id} />
          )}
        </div>

        {/* Mobile: AI panel overlay drawer */}
        {showAiPanel && (
          <div className="fixed inset-0 z-50 bg-background/80 lg:hidden">
            <div className="absolute right-0 top-0 h-full w-full max-w-md border-l bg-background shadow-lg">
              <div className="flex items-center justify-between border-b p-2">
                <span className="text-sm font-medium">AI Assistant</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAiPanel(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="h-[calc(100%-3rem)]">
                {showComments ? (
                  <div className="flex h-full flex-col">
                    <ScrollArea className="h-1/2 border-b">
                      <CommentsSidebar documentId={document._id} />
                    </ScrollArea>
                    <div className="h-1/2">
                      <AIPanel documentId={document._id} />
                    </div>
                  </div>
                ) : (
                  <AIPanel documentId={document._id} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: floating AI toggle button */}
      <div className="fixed bottom-4 right-4 lg:hidden">
        <Button
          size="lg"
          className="h-12 w-12 rounded-full shadow-lg"
          onClick={() => setShowAiPanel(!showAiPanel)}
        >
          <Bot className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
