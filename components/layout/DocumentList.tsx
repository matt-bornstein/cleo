"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function DocumentList() {
  const documents = useQuery(api.documents.list);
  const softDelete = useMutation(api.documents.softDelete);
  const createDoc = useMutation(api.documents.create);
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"documents">;
    title: string;
  } | null>(null);

  if (!documents) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading documents...</p>
      </div>
    );
  }

  const handleNewDoc = async () => {
    const docId = await createDoc({ title: "Untitled" });
    router.push(`/editor/${docId}`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-4 text-lg font-semibold">Your Documents</h2>
      <div className="space-y-2">
        <button
          className="cursor-pointer flex w-full items-center gap-3 rounded-lg border border-dashed p-4 text-left text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={handleNewDoc}
        >
          <Plus className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">New document</span>
        </button>
        {documents.map((doc) => (
          <div
            key={doc._id}
            className="flex w-full items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
          >
            <button
              className="cursor-pointer flex flex-1 items-center gap-3 min-w-0 text-left"
              onClick={() => router.push(`/editor/${doc._id}`)}
            >
              <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{doc.title || "Untitled"}</p>
                {doc.preview && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {doc.preview}
                  </p>
                )}
                <p className="text-xs text-muted-foreground/60">
                  Updated {new Date(doc.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <Badge variant="secondary">{doc.role}</Badge>
              {doc.role === "owner" && (
                <button
                  className="cursor-pointer rounded-md p-1.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete document"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({ id: doc._id, title: doc.title });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title || "Untitled"}&rdquo; will be removed
              from your document list. This can be undone later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteTarget) {
                  await softDelete({ id: deleteTarget.id });
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
