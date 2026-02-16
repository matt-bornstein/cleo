"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FilePlus,
  FolderOpen,
  Share2,
  Settings,
  LogOut,
  History,
  Download,
  FileText,
  FileCode,
  MessageSquare,
} from "lucide-react";
import { NewDocModal } from "@/components/modals/NewDocModal";
import { OpenDocModal } from "@/components/modals/OpenDocModal";
import { ShareModal } from "@/components/modals/ShareModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { VersionHistoryModal } from "@/components/modals/VersionHistoryModal";
import { useAuthActions } from "@convex-dev/auth/react";
import { Id } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { PresenceIndicator } from "@/components/editor/PresenceIndicator";
import { exportAsHtml, exportAsText, exportAsMarkdown, htmlToMarkdown } from "@/lib/export";

interface ToolbarProps {
  documentId?: Id<"documents">;
  documentTitle?: string;
  documentContent?: string;
  onToggleComments?: () => void;
  showComments?: boolean;
  getEditorHtml?: () => string | null;
}

export function Toolbar({
  documentId,
  documentTitle,
  documentContent,
  onToggleComments,
  showComments,
  getEditorHtml,
}: ToolbarProps) {
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [showOpenDoc, setShowOpenDoc] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(documentTitle || "");
  const { signOut } = useAuthActions();
  const updateTitle = useMutation(api.documents.updateTitle);

  const handleTitleSave = async () => {
    if (documentId && editTitle.trim()) {
      await updateTitle({ id: documentId, title: editTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleExportHtml = () => {
    // Prefer live editor HTML if available, fall back to cached content
    const liveHtml = getEditorHtml?.();
    if (liveHtml) {
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${documentTitle || "Document"}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.25em; }
    blockquote { border-left: 3px solid #ddd; padding-left: 1rem; color: #666; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 4px; }
    code { background: #f4f4f4; padding: 0.125rem 0.25rem; border-radius: 3px; }
    table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #ddd; padding: 0.5rem; }
    img { max-width: 100%; } hr { border: none; border-top: 1px solid #ddd; margin: 1.5rem 0; }
  </style>
</head>
<body>
${liveHtml}
</body>
</html>`;
      const blob = new Blob([fullHtml], { type: "text/html" });
      downloadBlob(blob, `${documentTitle || "document"}.html`);
    } else if (documentContent) {
      const html = exportAsHtml(documentContent, documentTitle || "Document");
      const blob = new Blob([html], { type: "text/html" });
      downloadBlob(blob, `${documentTitle || "document"}.html`);
    }
  };

  const handleExportMarkdown = () => {
    const liveHtml = getEditorHtml?.();
    if (liveHtml) {
      const md = htmlToMarkdown(liveHtml);
      const blob = new Blob([md], { type: "text/markdown" });
      downloadBlob(blob, `${documentTitle || "document"}.md`);
    } else if (documentContent) {
      const md = exportAsMarkdown(documentContent);
      const blob = new Blob([md], { type: "text/markdown" });
      downloadBlob(blob, `${documentTitle || "document"}.md`);
    }
  };

  const handleExportText = () => {
    if (!documentContent) return;
    const text = exportAsText(documentContent);
    const blob = new Blob([text], { type: "text/plain" });
    downloadBlob(blob, `${documentTitle || "document"}.txt`);
  };

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setShowNewDoc(true)}>
            <FilePlus className="mr-1 h-4 w-4" />
            New
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowOpenDoc(true)}>
            <FolderOpen className="mr-1 h-4 w-4" />
            Open
          </Button>
          {documentId && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowShare(true)}>
                <Share2 className="mr-1 h-4 w-4" />
                Share
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(true)}
              >
                <History className="mr-1 h-4 w-4" />
                History
              </Button>
              {onToggleComments && (
                <Button
                  variant={showComments ? "secondary" : "ghost"}
                  size="sm"
                  onClick={onToggleComments}
                >
                  <MessageSquare className="mr-1 h-4 w-4" />
                  Comments
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Download className="mr-1 h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleExportHtml}>
                    <FileCode className="mr-2 h-4 w-4" />
                    HTML
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportMarkdown}>
                    <FileText className="mr-2 h-4 w-4" />
                    Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportText}>
                    <FileText className="mr-2 h-4 w-4" />
                    Plain Text
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {documentId && <PresenceIndicator documentId={documentId} />}
          {documentId && (
            isEditingTitle ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSave();
                  if (e.key === "Escape") setIsEditingTitle(false);
                }}
                className="h-7 w-48 text-sm"
                autoFocus
              />
            ) : (
              <button
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setEditTitle(documentTitle || "");
                  setIsEditingTitle(true);
                }}
              >
                {documentTitle || "Untitled"}
              </button>
            )
          )}
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <NewDocModal open={showNewDoc} onOpenChange={setShowNewDoc} />
      <OpenDocModal open={showOpenDoc} onOpenChange={setShowOpenDoc} />
      {documentId && (
        <>
          <ShareModal
            open={showShare}
            onOpenChange={setShowShare}
            documentId={documentId}
          />
          <VersionHistoryModal
            open={showHistory}
            onOpenChange={setShowHistory}
            documentId={documentId}
          />
        </>
      )}
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </>
  );
}
