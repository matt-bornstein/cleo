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
import { RenameDocModal } from "@/components/modals/RenameDocModal";
import { normalizeDocumentId } from "@/lib/ai/documentId";
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
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";
import { normalizeEmailOrUndefined } from "@/lib/user/email";

type EditorShellProps = {
  documentId: unknown;
};

export function EditorShell({ documentId }: EditorShellProps) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings, refreshSettings } = useSettings();
  const currentUserEmail =
    normalizeEmailOrUndefined(settings.userEmail) ?? DEFAULT_LOCAL_USER_EMAIL;
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
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [saveStateLabel, setSaveStateLabel] = useState("Saved");
  const isOnline = useOnlineStatus();
  const { others, updateMyPresence } = usePresence(normalizedDocumentId);
  const { comments, createComment, createReply, markResolved } = useComments(
    normalizedDocumentId,
    currentUserEmail,
  );

  const currentDocument = getById(normalizedDocumentId);
  const documentTitle = currentDocument?.title ?? "Untitled";
  const myRole = safeGetRoleForUser(
    normalizedDocumentId,
    currentUserEmail,
    currentDocument?.ownerEmail,
  );
  const hasAccess = safeHasDocumentAccess(
    normalizedDocumentId,
    currentUserEmail,
    currentDocument?.ownerEmail,
  );
  const canEdit = hasPermission(myRole, "editor");
  const canComment = hasPermission(myRole, "commenter");
  const canShare = hasPermission(myRole, "owner");
  const requestedShareRole = sanitizeShareRole(
    readSearchParam(searchParams, "share"),
  );
  const content =
    currentDocument?.content ??
    JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph" }],
    });

  const { scheduleIdleSave } = useIdleSave({
    onIdle: () => {
      const latestDocument = getById(normalizedDocumentId);
      if (!latestDocument) return;
      const result = safeTriggerIdleSave({
        documentId: normalizedDocumentId,
        snapshot: latestDocument.content,
      });
      if (
        result &&
        typeof result === "object" &&
        "skipped" in result &&
        result.skipped === true
      ) {
        const reason = "reason" in result ? result.reason : undefined;
        setSaveStateLabel(reason === "dedup_window" ? "Saving..." : "Saved");
        return;
      }
      setSaveStateLabel("Saved");
    },
  });

  useEffect(() => {
    applyThemeSafely(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    if (!requestedShareRole) return;
    if (myRole === "owner" || myRole === requestedShareRole) return;

    const upserted = safeUpsertPermission(
      normalizedDocumentId,
      currentUserEmail,
      requestedShareRole,
    );
    if (upserted) {
      refreshDocuments();
    }
  }, [
    normalizedDocumentId,
    currentUserEmail,
    myRole,
    refreshDocuments,
    requestedShareRole,
  ]);

  useEffect(() => {
    if (!requestedShareRole) return;
    if (!(myRole === "owner" || myRole === requestedShareRole)) return;

    const params = new URLSearchParams(readSearchParamsString(searchParams));
    params.delete("share");
    const cleaned = params.toString();
    const nextPath = cleaned
      ? `/editor/${normalizedDocumentId}?${cleaned}`
      : `/editor/${normalizedDocumentId}`;
    safeRouterReplace(router, nextPath);
  }, [normalizedDocumentId, myRole, requestedShareRole, router, searchParams]);

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
    const target = getWindowEventTarget();
    if (!target) {
      return;
    }
    safeAddWindowListener(target, "keydown", handler);
    return () => safeRemoveWindowListener(target, "keydown", handler);
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
            onClick={() => safeRouterPush(router, "/editor")}
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
        onRenameDocument={() => setRenameModalOpen(true)}
        onNewDocument={() => setNewModalOpen(true)}
        onOpenDocument={() => setOpenModalOpen(true)}
        commentsVisible={commentsVisible}
        onToggleComments={() => setCommentsVisible((visible) => !visible)}
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
                key={normalizedDocumentId}
                documentId={normalizedDocumentId}
                title={documentTitle}
                content={content}
                otherPresence={others}
                saveStateLabel={saveStateLabel}
                fontSize={settings.editorFontSize}
                lineSpacing={settings.editorLineSpacing}
                readOnly={!canEdit}
                onContentChange={(nextContent: string) => {
                  if (!canEdit) return;
                  updateContent(normalizedDocumentId, nextContent);
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
            {commentsVisible ? (
              <CommentsSidebar
                comments={comments}
                onCreateComment={(commentText: string) =>
                  createComment(commentText, "Document selection")
                }
                onReplyComment={createReply}
                onResolveComment={markResolved}
                canComment={canComment}
              />
            ) : null}
          </div>
        }
        aiPanel={
          <AIPanel
            documentId={normalizedDocumentId}
            currentDocumentContent={content}
            currentUserId={currentUserEmail}
            defaultModel={settings.defaultModel}
            canEdit={canEdit}
            chatClearedAt={currentDocument?.chatClearedAt}
            onClearChat={(clearedAt: number) => {
              setChatClearedAt(normalizedDocumentId, clearedAt);
            }}
            onApplyContent={(nextContent: string) => {
              if (!canEdit) return;
              updateContent(normalizedDocumentId, nextContent);
              setSaveStateLabel("Saved");
            }}
          />
        }
      />
      <NewDocModal
        open={newModalOpen}
        onOpenChange={setNewModalOpen}
        onCreateDocument={(title: string) => {
          const newDocument = create(title, currentUserEmail);
          if (!newDocument || typeof newDocument !== "object") {
            safeRouterPush(router, "/editor");
            return;
          }
          const newDocumentId =
            "id" in newDocument && typeof newDocument.id === "string"
              ? newDocument.id
              : undefined;
          const newDocumentContent =
            "content" in newDocument && typeof newDocument.content === "string"
              ? newDocument.content
              : undefined;
          if (!newDocumentId || !newDocumentContent) {
            safeRouterPush(router, "/editor");
            return;
          }
          safeEnsureCreatedDiff({
            documentId: newDocumentId,
            snapshot: newDocumentContent,
          });
          safeRouterPush(router, `/editor/${newDocumentId}`);
        }}
      />
      <RenameDocModal
        open={renameModalOpen}
        onOpenChange={setRenameModalOpen}
        documentTitle={documentTitle}
        onRenameDocument={(nextTitle: string) => {
          updateTitle(normalizedDocumentId, nextTitle);
        }}
      />
      <OpenDocModal
        open={openModalOpen}
        onOpenChange={setOpenModalOpen}
        documents={documents}
        onOpenDocument={(nextDocumentId: string) =>
          safeRouterPush(router, `/editor/${nextDocumentId}`)
        }
        onDeleteDocument={(targetDocumentId: string) => {
          const removed = remove(targetDocumentId);
          if (!removed) return;
          if (targetDocumentId === normalizedDocumentId) {
            safeRouterPush(router, "/editor");
          }
        }}
      />
      <VersionHistoryModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
        documentId={normalizedDocumentId}
        onRestoreSnapshot={(snapshot: string) => {
          const result = safeRestoreVersion({
            documentId: normalizedDocumentId,
            snapshot,
          });
          if (result?.restored) {
            updateContent(normalizedDocumentId, snapshot);
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
        documentId={normalizedDocumentId}
        ownerEmail={currentDocument?.ownerEmail}
      />
      <SettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        onSaved={refreshSettings}
        onSignOut={async () => {
          await safeSignOutRequest();
          safeRouterPush(router, "/sign-in");
          safeRouterRefresh(router);
        }}
      />
    </div>
  );
}

function readSearchParam(searchParams: unknown, key: string) {
  if (!searchParams || typeof searchParams !== "object") {
    return null;
  }

  const getFn = readSearchParamsGetFunction(searchParams);
  if (!getFn) {
    return null;
  }

  try {
    return getFn(key);
  } catch {
    return null;
  }
}

function readSearchParamsString(searchParams: unknown) {
  if (!searchParams) {
    return "";
  }

  try {
    return String(searchParams);
  } catch {
    return "";
  }
}

async function safeSignOutRequest() {
  try {
    await fetch("/api/auth/local-signout", { method: "POST" });
  } catch {
    return;
  }
}

function safeRouterPush(router: unknown, path: string) {
  if (!router || typeof router !== "object" || !("push" in router)) {
    return;
  }

  try {
    const push = (router as { push?: unknown }).push;
    if (typeof push === "function") {
      push(path);
    }
  } catch {
    return;
  }
}

function safeRouterReplace(router: unknown, path: string) {
  if (!router || typeof router !== "object" || !("replace" in router)) {
    return;
  }

  try {
    const replace = (router as { replace?: unknown }).replace;
    if (typeof replace === "function") {
      replace(path);
    }
  } catch {
    return;
  }
}

function safeRouterRefresh(router: unknown) {
  if (!router || typeof router !== "object" || !("refresh" in router)) {
    return;
  }

  try {
    const refresh = (router as { refresh?: unknown }).refresh;
    if (typeof refresh === "function") {
      refresh();
    }
  } catch {
    return;
  }
}

function readSearchParamsGetFunction(searchParams: unknown) {
  if (!searchParams || typeof searchParams !== "object" || !("get" in searchParams)) {
    return undefined;
  }

  try {
    const candidate = (searchParams as { get?: unknown }).get;
    if (typeof candidate !== "function") {
      return undefined;
    }

    const owner = searchParams as { get: (name: string) => string | null };
    return (name: string) => Reflect.apply(candidate, owner, [name]) as string | null;
  } catch {
    return undefined;
  }
}

function safeGetRoleForUser(
  documentId: string,
  userEmail: string,
  ownerEmail?: string,
) {
  try {
    return getRoleForUser(documentId, userEmail, ownerEmail);
  } catch {
    return "viewer";
  }
}

function safeHasDocumentAccess(
  documentId: string,
  userEmail: string,
  ownerEmail?: string,
) {
  try {
    return hasDocumentAccess(documentId, userEmail, ownerEmail);
  } catch {
    return false;
  }
}

function safeUpsertPermission(
  documentId: string,
  email: string,
  role: Parameters<typeof upsertPermission>[2],
) {
  try {
    return upsertPermission(documentId, email, role);
  } catch {
    return null;
  }
}

function safeTriggerIdleSave(payload: Parameters<typeof triggerIdleSave>[0]) {
  try {
    return triggerIdleSave(payload);
  } catch {
    return null;
  }
}

function safeEnsureCreatedDiff(payload: Parameters<typeof ensureCreatedDiff>[0]) {
  try {
    ensureCreatedDiff(payload);
  } catch {
    return;
  }
}

function safeRestoreVersion(payload: Parameters<typeof restoreVersion>[0]) {
  try {
    return restoreVersion(payload);
  } catch {
    return null;
  }
}

function applyThemeSafely(theme: unknown) {
  const normalizedTheme = typeof theme === "string" ? theme.trim() : "";
  if (!normalizedTheme || typeof document === "undefined") {
    return;
  }

  try {
    if (document.documentElement?.dataset) {
      document.documentElement.dataset.theme = normalizedTheme;
    }
  } catch {
    return;
  }
}

function getWindowEventTarget() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return typeof window.addEventListener === "function" &&
      typeof window.removeEventListener === "function"
      ? window
      : null;
  } catch {
    return null;
  }
}

function safeAddWindowListener(
  target: Pick<Window, "addEventListener">,
  eventType: string,
  listener: (event: KeyboardEvent) => void,
) {
  try {
    target.addEventListener(eventType, listener as EventListener);
  } catch {
    return;
  }
}

function safeRemoveWindowListener(
  target: Pick<Window, "removeEventListener">,
  eventType: string,
  listener: (event: KeyboardEvent) => void,
) {
  try {
    target.removeEventListener(eventType, listener as EventListener);
  } catch {
    return;
  }
}
