"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Copy } from "lucide-react";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: Id<"documents">;
}

export function ShareModal({ open, onOpenChange, documentId }: ShareModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "commenter" | "viewer">("editor");
  const [error, setError] = useState("");
  const permissions = useQuery(api.permissions.getPermissions, { documentId });
  const shareMutation = useMutation(api.permissions.share);
  const unshareMutation = useMutation(api.permissions.unshare);

  const handleShare = async () => {
    if (!email.trim()) return;
    setError("");
    try {
      await shareMutation({ documentId, email: email.trim(), role });
      setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to share");
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/editor/${documentId}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add user */}
          <div className="flex gap-2">
            <Input
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleShare();
              }}
            />
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="commenter">Commenter</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleShare}>Share</Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Current permissions */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">People with access</h4>
            {permissions?.map((perm) => (
              <div
                key={perm._id}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <div>
                  <p className="text-sm font-medium">{perm.userName}</p>
                  <p className="text-xs text-muted-foreground">
                    {perm.userEmail}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{perm.role}</Badge>
                  {perm.role !== "owner" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void unshareMutation({
                          documentId,
                          permissionId: perm._id,
                        })
                      }
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Copy link */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleCopyLink}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
