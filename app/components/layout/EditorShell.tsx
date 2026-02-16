"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AIPanel } from "@/components/ai/AIPanel";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { EditorLayout } from "@/components/layout/EditorLayout";
import { Toolbar } from "@/components/layout/Toolbar";
import { NewDocModal } from "@/components/modals/NewDocModal";
import { OpenDocModal } from "@/components/modals/OpenDocModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { ShareModal } from "@/components/modals/ShareModal";
import { useDocuments } from "@/hooks/useDocuments";

type EditorShellProps = {
  documentId: string;
};

export function EditorShell({ documentId }: EditorShellProps) {
  const router = useRouter();
  const { documents, create, getById } = useDocuments();
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const currentDocument = useMemo(() => getById(documentId), [documentId, getById]);
  const documentTitle = currentDocument?.title ?? "Untitled";

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
        editorPanel={<EditorPanel title={documentTitle} />}
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
