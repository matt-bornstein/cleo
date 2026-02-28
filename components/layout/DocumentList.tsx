"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Trash2,
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Pencil,
  FolderInput,
  Eye,
} from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Doc = {
  _id: Id<"documents">;
  title: string;
  preview: string;
  folderId?: Id<"folders">;
  updatedAt: number;
  createdAt: number;
  role: string;
};

type FolderDoc = {
  _id: Id<"folders">;
  name: string;
};

export function DocumentList() {
  const documents = useQuery(api.documents.list);
  const folders = useQuery(api.folders.list);
  const softDelete = useMutation(api.documents.softDelete);
  const createDoc = useMutation(api.documents.create);
  const createFolder = useMutation(api.folders.create);
  const renameFolder = useMutation(api.folders.rename);
  const removeFolder = useMutation(api.folders.remove);
  const moveToFolder = useMutation(api.documents.moveToFolder);


  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && folders?.length) {
      initializedRef.current = true;
      setCollapsedFolders(new Set(folders.map((f) => f._id)));
    }
  }, [folders]);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "document" | "folder";
    id: Id<"documents"> | Id<"folders">;
    title: string;
  } | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<Id<"folders"> | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingFolderId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingFolderId]);

  useEffect(() => {
    if (creatingFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [creatingFolder]);

  if (!documents || !folders) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading documents...</p>
      </div>
    );
  }

  const toggleFolder = (folderId: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleNewDoc = async (folderId?: Id<"folders">) => {
    const docId = await createDoc({ title: "Untitled", folderId });
    window.open(`/editor/${docId}`, "_blank");
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      setCreatingFolder(false);
      setNewFolderName("");
      return;
    }
    await createFolder({ name });
    setCreatingFolder(false);
    setNewFolderName("");
  };

  const handleRenameFolder = async (id: Id<"folders">) => {
    const name = renameValue.trim();
    if (!name) {
      setRenamingFolderId(null);
      return;
    }
    await renameFolder({ id, name });
    setRenamingFolderId(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "document") {
      await softDelete({ id: deleteTarget.id as Id<"documents"> });
    } else {
      await removeFolder({ id: deleteTarget.id as Id<"folders"> });
    }
    setDeleteTarget(null);
  };

  const handleDrop = (e: React.DragEvent, folderId?: Id<"folders">) => {
    e.preventDefault();
    setDragOverTarget(null);
    const docId = e.dataTransfer.getData("application/x-doc-id") as Id<"documents">;
    if (docId) {
      moveToFolder({ id: docId, folderId });
    }
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    if (e.dataTransfer.types.includes("application/x-doc-id")) {
      e.preventDefault();
      setDragOverTarget(targetId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverTarget(null);
    }
  };

  const docsByFolder = new Map<string, Doc[]>();
  const unfiledDocs: Doc[] = [];

  for (const doc of documents) {
    if (doc.folderId) {
      const key = doc.folderId;
      if (!docsByFolder.has(key)) docsByFolder.set(key, []);
      docsByFolder.get(key)!.push(doc);
    } else {
      unfiledDocs.push(doc);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-4 text-lg font-semibold">Your Documents</h2>
      <div className="space-y-2">
        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            className="cursor-pointer flex flex-1 items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => handleNewDoc()}
          >
            <Plus className="h-5 w-5 flex-shrink-0" />
            <span className="font-medium">New document</span>
          </button>
          <button
            className="cursor-pointer flex flex-1 items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => {
              setCreatingFolder(true);
              setNewFolderName("");
            }}
          >
            <FolderPlus className="h-5 w-5 flex-shrink-0" />
            <span className="font-medium">New folder</span>
          </button>
        </div>

        {/* New folder inline input */}
        {creatingFolder && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-accent/50 p-3">
            <Folder className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <Input
              ref={newFolderInputRef}
              className="h-8 text-sm"
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") {
                  setCreatingFolder(false);
                  setNewFolderName("");
                }
              }}
              onBlur={handleCreateFolder}
            />
          </div>
        )}

        {/* Folder sections */}
        {folders.length > 0 && (
          <div className="pt-1">
            <p className="px-1 pb-1 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
              Folders
            </p>
          </div>
        )}
        {folders.map((folder) => {
          const folderDocs = docsByFolder.get(folder._id) ?? [];
          const isCollapsed = collapsedFolders.has(folder._id);
          const isRenaming = renamingFolderId === folder._id;

          return (
            <div
              key={folder._id}
              className={`space-y-1 rounded-lg transition-colors ${
                dragOverTarget === folder._id
                  ? "bg-primary/5 p-1"
                  : ""
              }`}
              onDragOver={(e) => handleDragOver(e, folder._id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folder._id)}
            >
              {/* Folder header */}
              <div
                className={`cursor-pointer flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  dragOverTarget === folder._id
                    ? "border-primary bg-primary/10"
                    : "bg-muted/40 hover:bg-muted/70"
                }`}
                role="button"
                tabIndex={0}
                onClick={() => toggleFolder(folder._id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleFolder(folder._id); }}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
                <Folder className="h-4 w-4 flex-shrink-0 text-muted-foreground" />

                {isRenaming ? (
                  <Input
                    ref={renameInputRef}
                    className="h-7 text-sm flex-1"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameFolder(folder._id);
                      if (e.key === "Escape") setRenamingFolderId(null);
                    }}
                    onBlur={() => handleRenameFolder(folder._id)}
                  />
                ) : (
                  <span className="flex-1 text-sm font-medium">
                    {folder.name}
                  </span>
                )}

                <span className="text-xs text-muted-foreground/60">
                  {folderDocs.length}
                </span>
                <button
                  className="cursor-pointer rounded-md p-1 text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
                  title="Rename folder"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingFolderId(folder._id);
                    setRenameValue(folder.name);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  className="cursor-pointer rounded-md p-1 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete folder"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({
                      type: "folder",
                      id: folder._id,
                      title: folder.name,
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Folder documents */}
              {!isCollapsed && (
                <div className="ml-4 space-y-1">
                  {folderDocs.length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground/60 italic">
                      No documents
                    </p>
                  )}
                  {folderDocs.map((doc) => (
                    <DocumentRow
                      key={doc._id}
                      doc={doc}
                      folders={folders}
                      onNavigate={() => window.open(`/editor/${doc._id}`, "_blank")}
                      onDelete={() =>
                        setDeleteTarget({
                          type: "document",
                          id: doc._id,
                          title: doc.title,
                        })
                      }
                      onMove={(folderId) =>
                        moveToFolder({ id: doc._id, folderId })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Unfiled documents */}
        {folders.length > 0 && (
          <div
            className={`pt-1 rounded-lg transition-colors ${
              dragOverTarget === "unfiled"
                ? "border border-primary bg-primary/10 px-1"
                : ""
            }`}
            onDragOver={(e) => handleDragOver(e, "unfiled")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, undefined)}
          >
            <p className="px-1 pb-1 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
              Unfiled
            </p>
            {unfiledDocs.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground/60 italic">
                Drop documents here to unfile them
              </p>
            )}
          </div>
        )}
        {unfiledDocs.map((doc) => (
          <DocumentRow
            key={doc._id}
            doc={doc}
            folders={folders}
            onNavigate={() => window.open(`/editor/${doc._id}`, "_blank")}
            onDelete={() =>
              setDeleteTarget({
                type: "document",
                id: doc._id,
                title: doc.title,
              })
            }
            onMove={(folderId) =>
              moveToFolder({ id: doc._id, folderId })
            }
          />
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === "folder" ? "folder" : "document"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "folder" ? (
                <>
                  &ldquo;{deleteTarget?.title}&rdquo; will be deleted.
                  Documents inside will be moved to Unfiled.
                </>
              ) : (
                <>
                  &ldquo;{deleteTarget?.title || "Untitled"}&rdquo; will be
                  removed from your document list. This can be undone later.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DocumentRow({
  doc,
  folders,
  onNavigate,
  onDelete,
  onMove,
}: {
  doc: Doc;
  folders: FolderDoc[];
  onNavigate: () => void;
  onDelete: () => void;
  onMove: (folderId?: Id<"folders">) => void;
}) {
  const [moveOpen, setMoveOpen] = useState(false);

  return (
    <div
      className="cursor-pointer flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left transition-colors hover:bg-accent"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-doc-id", doc._id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onNavigate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate(); }}
    >
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium">{doc.title || "Untitled"}</p>
          <p className="text-xs text-muted-foreground/60">
            Updated {new Date(doc.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
        <Badge variant="secondary">{doc.role}</Badge>
        {doc.preview && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="cursor-pointer rounded-md p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Eye className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="max-w-xs whitespace-pre-wrap text-left"
              >
                {doc.preview}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {folders.length > 0 && (
          <Popover open={moveOpen} onOpenChange={setMoveOpen}>
            <PopoverTrigger asChild>
              <button
                className="cursor-pointer rounded-md p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
                title="Move to folder"
                onClick={(e) => e.stopPropagation()}
              >
                <FolderInput className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-0.5">
                {folders.map((folder) => (
                  <button
                    key={folder._id}
                    className="cursor-pointer flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                    onClick={() => {
                      onMove(folder._id);
                      setMoveOpen(false);
                    }}
                  >
                    <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                    <span
                      className={
                        doc.folderId === folder._id ? "font-medium" : ""
                      }
                    >
                      {folder.name}
                    </span>
                  </button>
                ))}
                <button
                  className="cursor-pointer flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                  onClick={() => {
                    onMove(undefined);
                    setMoveOpen(false);
                  }}
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className={!doc.folderId ? "font-medium" : ""}>
                    Unfiled
                  </span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}
        {doc.role === "owner" && (
          <button
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete document"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
