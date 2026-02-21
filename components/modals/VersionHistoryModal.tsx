"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, RotateCcw, Bot, Pencil, Plus, Eye, ArrowLeft } from "lucide-react";
import { prosemirrorJsonToHtml } from "@/lib/editor/htmlSerializer";

interface VersionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: Id<"documents">;
}

export function VersionHistoryModal({
  open,
  onOpenChange,
  documentId,
}: VersionHistoryModalProps) {
  const diffs = useQuery(api.diffs.listByDocument, { documentId });
  const restore = useMutation(api.diffs.restore);
  const [previewDiffId, setPreviewDiffId] = useState<Id<"diffs"> | null>(null);

  const previewDiff = diffs?.find((d) => d._id === previewDiffId);

  const handleRestore = async (diffId: Id<"diffs">) => {
    if (
      !window.confirm(
        "Restore this version? Current changes will be saved as a new version."
      )
    ) {
      return;
    }
    await restore({ documentId, diffId });
    setPreviewDiffId(null);
    onOpenChange(false);
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "ai":
        return <Bot className="h-3 w-3" />;
      case "manual":
        return <Pencil className="h-3 w-3" />;
      case "created":
        return <Plus className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "ai":
        return "AI Edit";
      case "manual":
        return "Auto-save";
      case "created":
        return "Created";
      default:
        return source;
    }
  };

  const getPreviewHtml = (snapshotAfter: string): string => {
    try {
      const doc = JSON.parse(snapshotAfter);
      return prosemirrorJsonToHtml(doc);
    } catch {
      return "<p>Unable to preview this version</p>";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setPreviewDiffId(null); }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {previewDiff ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewDiffId(null)}
                  className="h-7 px-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span>
                  Preview — {getSourceLabel(previewDiff.source)}{" "}
                  {new Date(previewDiff.createdAt).toLocaleString()}
                </span>
              </div>
            ) : (
              "Version History"
            )}
          </DialogTitle>
        </DialogHeader>

        {previewDiff ? (
          /* Version preview */
          <div className="space-y-3">
            <ScrollArea className="h-[350px] rounded-md border p-4">
              <div
                className="tiptap-content text-sm"
                dangerouslySetInnerHTML={{
                  __html: getPreviewHtml(previewDiff.snapshotAfter),
                }}
              />
            </ScrollArea>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewDiffId(null)}
              >
                Back to list
              </Button>
              <Button
                size="sm"
                onClick={() => handleRestore(previewDiff._id)}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Restore this version
              </Button>
            </div>
          </div>
        ) : (
          /* Version list */
          <ScrollArea className="max-h-[400px]">
            {!diffs ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Loading...
              </p>
            ) : diffs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No version history yet.
              </p>
            ) : (
              <div className="space-y-2">
                {diffs.map((diff, index) => (
                  <div
                    key={diff._id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        {getSourceIcon(diff.source)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {getSourceLabel(diff.source)}
                          </Badge>
                          {diff.aiModel && (
                            <span className="text-xs text-muted-foreground">
                              {diff.aiModel}
                            </span>
                          )}
                          {index === 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Latest
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{diff.userName}</span>
                          <span>•</span>
                          <span>
                            {new Date(diff.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {diff.aiPrompt && (
                          <p className="mt-1 text-xs text-muted-foreground truncate max-w-[300px]">
                            &ldquo;{diff.aiPrompt}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewDiffId(diff._id)}
                        className="text-xs"
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Preview
                      </Button>
                      {index > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(diff._id)}
                          className="text-xs"
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
