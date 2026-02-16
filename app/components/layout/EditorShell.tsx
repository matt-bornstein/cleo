"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AIPanel } from "@/components/ai/AIPanel";
import { CommentsSidebar } from "@/components/comments/CommentsSidebar";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { EditorLayout } from "@/components/layout/EditorLayout";
import { Toolbar } from "@/components/layout/Toolbar";
import { NewDocModal } from "@/components/modals/NewDocModal";
import { OpenDocModal } from "@/components/modals/OpenDocModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { ShareModal } from "@/components/modals/ShareModal";
import { triggerIdleSave } from "@/lib/diffs/store";
import { useComments } from "@/hooks/useComments";
import { useIdleSave } from "@/hooks/useIdleSave";
import { useDocuments } from "@/hooks/useDocuments";
import { usePresence } from "@/hooks/usePresence";

type EditorShellProps = {
  documentId: string;
};

export function EditorShell({ documentId }: EditorShellProps) {
  const router = useRouter();
  const { documents, create, getById, updateContent } = useDocuments();
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [saveStateLabel, setSaveStateLabel] = useState("Saved");
  const { others, updateMyPresence } = usePresence(documentId);
  const { comments, createComment, markResolved } = useComments(documentId);

  const currentDocument = getById(documentId);
  const documentTitle = currentDocument?.title ?? "Untitled";
  const content =
    currentDocument?.content ??
    JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph" }],
    });

  const { scheduleIdleSave } = useIdleSave({
    onIdle: () => {
      const latestDocument = getById(documentId);
      if (!latestDocument) return;
      const result = triggerIdleSave({
        documentId,
        snapshot: latestDocument.content,
      });
      if (result.skipped) {
        setSaveStateLabel(result.reason === "dedup_window" ? "Saving..." : "Saved");
        return;
      }
      setSaveStateLabel("Saved");
    },
  });

  return (
    <div className="min-h-screen bg-slate-100">
      <Toolbar
        documentTitle={documentTitle}
        onNewDocument={() => setNewModalOpen(true)}
        onOpenDocument={() => setOpenModalOpen(true)}
        onShare={() => setShareModalOpen(true)}
        onSettings={() => setSettingsModalOpen(true)}
      />
      <EditorLayout
        editorPanel={
          <div className="flex h-full">
            <div className="flex-1">
              <EditorPanel
                key={documentId}
                title={documentTitle}
                content={content}
                otherPresence={others}
                saveStateLabel={saveStateLabel}
                onContentChange={(nextContent) => {
                  updateContent(documentId, nextContent);
                }}
                onLocalUpdate={() => {
                  setSaveStateLabel("Saving...");
                  updateMyPresence({
                    name: "You",
                    color: "#3b82f6",
                  });
                  scheduleIdleSave();
                }}
              />
            </div>
            <CommentsSidebar
              comments={comments}
              onCreateComment={(commentText) =>
                createComment(commentText, "Document selection")
              }
              onResolveComment={markResolved}
            />
          </div>
        }
        aiPanel={
          <AIPanel
            documentId={documentId}
            currentDocumentContent={content}
            onApplyContent={(nextContent) => {
              updateContent(documentId, nextContent);
              setSaveStateLabel("Saved");
            }}
          />
        }
      />
      <NewDocModal
        open={newModalOpen}
        onOpenChange={setNewModalOpen}
        onCreateDocument={(title) => {
          const newDocument = create(title);
          router.push(`/editor/${newDocument.id}`);
        }}
      />
      <OpenDocModal
        open={openModalOpen}
        onOpenChange={setOpenModalOpen}
        documents={documents}
        onOpenDocument={(nextDocumentId) => router.push(`/editor/${nextDocumentId}`)}
      />
      <ShareModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        documentId={documentId}
      />
      <SettingsModal open={settingsModalOpen} onOpenChange={setSettingsModalOpen} />
    </div>
  );
}
