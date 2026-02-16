"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AIPanel } from "@/components/ai/AIPanel";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { EditorLayout } from "@/components/layout/EditorLayout";
import { Toolbar } from "@/components/layout/Toolbar";
import { NewDocModal } from "@/components/modals/NewDocModal";
import { OpenDocModal } from "@/components/modals/OpenDocModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { ShareModal } from "@/components/modals/ShareModal";
import { triggerIdleSave } from "@/lib/diffs/store";
import { useIdleSave } from "@/hooks/useIdleSave";
import { useDocuments } from "@/hooks/useDocuments";

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
          <EditorPanel
            key={documentId}
            title={documentTitle}
            content={content}
            saveStateLabel={saveStateLabel}
            onContentChange={(nextContent) => {
              updateContent(documentId, nextContent);
            }}
            onLocalUpdate={() => {
              setSaveStateLabel("Saving...");
              scheduleIdleSave();
            }}
          />
        }
        aiPanel={<AIPanel />}
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
      <ShareModal open={shareModalOpen} onOpenChange={setShareModalOpen} />
      <SettingsModal open={settingsModalOpen} onOpenChange={setSettingsModalOpen} />
    </div>
  );
}
