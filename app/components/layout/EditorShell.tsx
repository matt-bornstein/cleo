"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AIPanel } from "@/components/ai/AIPanel";
import { CommentsSidebar } from "@/components/comments/CommentsSidebar";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { EditorLayout } from "@/components/layout/EditorLayout";
import { Toolbar } from "@/components/layout/Toolbar";
import { NewDocModal } from "@/components/modals/NewDocModal";
import { OpenDocModal } from "@/components/modals/OpenDocModal";
import { ExportModal } from "@/components/modals/ExportModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { ShareModal } from "@/components/modals/ShareModal";
import { VersionHistoryModal } from "@/components/modals/VersionHistoryModal";
import { ensureCreatedDiff, restoreVersion, triggerIdleSave } from "@/lib/diffs/store";
import { useComments } from "@/hooks/useComments";
import { useIdleSave } from "@/hooks/useIdleSave";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useDocuments } from "@/hooks/useDocuments";
import { usePresence } from "@/hooks/usePresence";
import { useSettings } from "@/hooks/useSettings";
import { getRoleForUser } from "@/lib/permissions/store";
import { hasPermission } from "@/lib/permissions";

type EditorShellProps = {
  documentId: string;
};

export function EditorShell({ documentId }: EditorShellProps) {
  const router = useRouter();
  const {
    documents,
    create,
    getById,
    updateTitle,
    updateContent,
    setChatClearedAt,
    remove,
  } = useDocuments();
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [saveStateLabel, setSaveStateLabel] = useState("Saved");
  const { settings, refreshSettings } = useSettings();
  const isOnline = useOnlineStatus();
  const { others, updateMyPresence } = usePresence(documentId);
  const { comments, createComment, createReply, markResolved } = useComments(documentId);

  const currentDocument = getById(documentId);
  const documentTitle = currentDocument?.title ?? "Untitled";
  const currentUserEmail = settings.userEmail ?? "me@local.dev";
  const myRole = getRoleForUser(
    documentId,
    currentUserEmail,
    currentDocument?.ownerEmail,
  );
  const canEdit = hasPermission(myRole, "editor");
  const canComment = hasPermission(myRole, "commenter");
  const canShare = hasPermission(myRole, "owner");
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

  useEffect(() => {
    if (settings.theme) {
      document.documentElement.dataset.theme = settings.theme;
    }
  }, [settings.theme]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;
      if (!isMeta) return;
      const key = event.key.toLowerCase();

      if (key === "n") {
        event.preventDefault();
        setNewModalOpen(true);
      }

      if (key === "o") {
        event.preventDefault();
        setOpenModalOpen(true);
      }

      if (key === "h") {
        event.preventDefault();
        setHistoryModalOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <Toolbar
        documentTitle={documentTitle}
        roleLabel={myRole}
        onRenameDocument={(nextTitle) => {
          updateTitle(documentId, nextTitle);
        }}
        onNewDocument={() => setNewModalOpen(true)}
        onOpenDocument={() => setOpenModalOpen(true)}
        onHistory={() => setHistoryModalOpen(true)}
        onExport={() => setExportModalOpen(true)}
        onShare={() => setShareModalOpen(true)}
        onSettings={() => setSettingsModalOpen(true)}
        canShare={canShare}
      />
      {!isOnline ? (
        <div className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-xs font-medium text-amber-900">
          You are offline. Reconnect to sync collaboration and AI features.
        </div>
      ) : null}
      <EditorLayout
        editorPanel={
          <div className="flex h-full">
            <div className="flex-1">
              <EditorPanel
                key={documentId}
                documentId={documentId}
                title={documentTitle}
                content={content}
                otherPresence={others}
                saveStateLabel={saveStateLabel}
                fontSize={settings.editorFontSize}
                lineSpacing={settings.editorLineSpacing}
                readOnly={!canEdit}
                onContentChange={(nextContent) => {
                  if (!canEdit) return;
                  updateContent(documentId, nextContent);
                }}
                onLocalUpdate={() => {
                  if (!canEdit) return;
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
              onReplyComment={createReply}
              onResolveComment={markResolved}
              canComment={canComment}
            />
          </div>
        }
        aiPanel={
          <AIPanel
            documentId={documentId}
            currentDocumentContent={content}
            currentUserId={currentUserEmail}
            defaultModel={settings.defaultModel}
            canEdit={canEdit}
            chatClearedAt={currentDocument?.chatClearedAt}
            onClearChat={(clearedAt) => {
              setChatClearedAt(documentId, clearedAt);
            }}
            onApplyContent={(nextContent) => {
              if (!canEdit) return;
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
          const newDocument = create(title, currentUserEmail);
          ensureCreatedDiff({
            documentId: newDocument.id,
            snapshot: newDocument.content,
          });
          router.push(`/editor/${newDocument.id}`);
        }}
      />
      <OpenDocModal
        open={openModalOpen}
        onOpenChange={setOpenModalOpen}
        documents={documents}
        onOpenDocument={(nextDocumentId) => router.push(`/editor/${nextDocumentId}`)}
        onDeleteDocument={(targetDocumentId) => {
          const removed = remove(targetDocumentId);
          if (!removed) return;
          if (targetDocumentId === documentId) {
            router.push("/editor");
          }
        }}
      />
      <VersionHistoryModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
        documentId={documentId}
        onRestoreSnapshot={(snapshot) => {
          const result = restoreVersion({
            documentId,
            snapshot,
          });
          if (result.restored) {
            updateContent(documentId, snapshot);
            setSaveStateLabel("Saved");
          }
        }}
      />
      <ExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        documentTitle={documentTitle}
        content={content}
      />
      <ShareModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        documentId={documentId}
        ownerEmail={currentDocument?.ownerEmail}
      />
      <SettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        onSaved={refreshSettings}
        onSignOut={async () => {
          await fetch("/api/auth/local-signout", { method: "POST" });
          router.push("/sign-in");
          router.refresh();
        }}
      />
    </div>
  );
}
