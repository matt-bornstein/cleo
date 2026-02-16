"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
import {
  getRoleForUser,
  hasDocumentAccess,
  upsertPermission,
} from "@/lib/permissions/store";
import { hasPermission } from "@/lib/permissions";
import { sanitizeShareRole } from "@/lib/permissions/shareLink";

type EditorShellProps = {
  documentId: string;
};

export function EditorShell({ documentId }: EditorShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings, refreshSettings } = useSettings();
  const currentUserEmail = settings.userEmail ?? "me@local.dev";
  const {
    documents,
    create,
    getById,
    updateTitle,
    updateContent,
    setChatClearedAt,
    remove,
    refresh: refreshDocuments,
  } = useDocuments(undefined, currentUserEmail);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [saveStateLabel, setSaveStateLabel] = useState("Saved");
  const isOnline = useOnlineStatus();
  const { others, updateMyPresence } = usePresence(documentId);
  const { comments, createComment, createReply, markResolved } = useComments(
    documentId,
    currentUserEmail,
  );

  const currentDocument = getById(documentId);
  const documentTitle = currentDocument?.title ?? "Untitled";
  const myRole = getRoleForUser(
    documentId,
    currentUserEmail,
    currentDocument?.ownerEmail,
  );
  const hasAccess = hasDocumentAccess(
    documentId,
    currentUserEmail,
    currentDocument?.ownerEmail,
  );
  const canEdit = hasPermission(myRole, "editor");
  const canComment = hasPermission(myRole, "commenter");
  const canShare = hasPermission(myRole, "owner");
  const requestedShareRole = sanitizeShareRole(searchParams.get("share"));
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
    if (!requestedShareRole) return;
    if (myRole === "owner" || myRole === requestedShareRole) return;

    upsertPermission(documentId, currentUserEmail, requestedShareRole);
    refreshDocuments();
  }, [documentId, currentUserEmail, myRole, refreshDocuments, requestedShareRole]);

  useEffect(() => {
    if (!requestedShareRole) return;
    if (!(myRole === "owner" || myRole === requestedShareRole)) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("share");
    const cleaned = params.toString();
    const nextPath = cleaned ? `/editor/${documentId}?${cleaned}` : `/editor/${documentId}`;
    router.replace(nextPath);
  }, [documentId, myRole, requestedShareRole, router, searchParams]);

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

  if (!hasAccess && !requestedShareRole) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <section className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Access required</h1>
          <p className="mt-2 text-sm text-slate-600">
            You do not have permission to open this document.
          </p>
          <button
            type="button"
            className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            onClick={() => router.push("/editor")}
          >
            Return to document list
          </button>
        </section>
      </main>
    );
  }

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
      {!hasAccess && requestedShareRole ? (
        <div className="border-b border-blue-300 bg-blue-100 px-4 py-2 text-xs font-medium text-blue-900">
          Applying shared access permissions...
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
