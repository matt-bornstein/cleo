"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

export function DocumentList() {
  const documents = useQuery(api.documents.list);
  const router = useRouter();

  if (!documents) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading documents...</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">No documents yet</h2>
        <p className="text-sm text-muted-foreground">
          Click &quot;New&quot; to create your first document.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-4 text-lg font-semibold">Your Documents</h2>
      <div className="space-y-2">
        {documents.map((doc) => (
          <button
            key={doc._id}
            className="flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-accent"
            onClick={() => router.push(`/editor/${doc._id}`)}
          >
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{doc.title || "Untitled"}</p>
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(doc.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Badge variant="secondary">{doc.role}</Badge>
          </button>
        ))}
      </div>
    </div>
  );
}
