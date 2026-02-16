"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

interface OpenDocModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpenDocModal({ open, onOpenChange }: OpenDocModalProps) {
  const [search, setSearch] = useState("");
  const documents = useQuery(api.documents.list);
  const router = useRouter();

  const filtered = documents?.filter((doc) =>
    doc.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Open Document</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {!filtered ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Loading...
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No documents found
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((doc) => (
                <button
                  key={doc._id}
                  className="flex w-full items-center justify-between rounded-md p-3 text-left transition-colors hover:bg-accent"
                  onClick={() => {
                    router.push(`/editor/${doc._id}`);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {doc.title || "Untitled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {doc.role}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
