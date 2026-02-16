"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FilePlus, FolderOpen, Share2, Settings, LogOut } from "lucide-react";
import { NewDocModal } from "@/components/modals/NewDocModal";
import { OpenDocModal } from "@/components/modals/OpenDocModal";
import { ShareModal } from "@/components/modals/ShareModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { useAuthActions } from "@convex-dev/auth/react";
import { Id } from "@/convex/_generated/dataModel";

interface ToolbarProps {
  documentId?: Id<"documents">;
  documentTitle?: string;
}

export function Toolbar({ documentId, documentTitle }: ToolbarProps) {
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [showOpenDoc, setShowOpenDoc] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { signOut } = useAuthActions();

  return (
    <>
      <div className="flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowNewDoc(true)}>
            <FilePlus className="mr-1 h-4 w-4" />
            New
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowOpenDoc(true)}>
            <FolderOpen className="mr-1 h-4 w-4" />
            Open
          </Button>
          {documentId && (
            <Button variant="ghost" size="sm" onClick={() => setShowShare(true)}>
              <Share2 className="mr-1 h-4 w-4" />
              Share
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
            <Settings className="mr-1 h-4 w-4" />
            Settings
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {documentTitle && (
            <span className="text-sm font-medium text-muted-foreground">
              {documentTitle}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <NewDocModal open={showNewDoc} onOpenChange={setShowNewDoc} />
      <OpenDocModal open={showOpenDoc} onOpenChange={setShowOpenDoc} />
      {documentId && (
        <ShareModal
          open={showShare}
          onOpenChange={setShowShare}
          documentId={documentId}
        />
      )}
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </>
  );
}
