"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Reply, Trash2 } from "lucide-react";

interface Comment {
  _id: Id<"comments">;
  content: string;
  userName: string;
  resolved: boolean;
  anchorText: string;
  createdAt: number;
}

interface CommentThreadProps {
  comment: Comment;
  replies: Comment[];
  documentId: Id<"documents">;
}

export function CommentThread({
  comment,
  replies,
  documentId,
}: CommentThreadProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const resolveComment = useMutation(api.comments.resolve);
  const replyToComment = useMutation(api.comments.reply);
  const deleteComment = useMutation(api.comments.remove);

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    await replyToComment({
      documentId,
      parentCommentId: comment._id,
      content: replyContent.trim(),
    });
    setReplyContent("");
    setShowReply(false);
  };

  return (
    <div
      className={`rounded-lg border p-3 ${
        comment.resolved ? "opacity-50" : ""
      }`}
    >
      {/* Anchor text */}
      {comment.anchorText && (
        <div className="mb-2 rounded bg-muted px-2 py-1 text-xs italic text-muted-foreground">
          &ldquo;{comment.anchorText}&rdquo;
        </div>
      )}

      {/* Comment */}
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">{comment.userName}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleDateString()}
          </span>
        </div>
        <p className="mt-1 text-sm">{comment.content}</p>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-4 space-y-2 border-l pl-3">
          {replies.map((reply) => (
            <div key={reply._id}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{reply.userName}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(reply.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-0.5 text-sm">{reply.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-2 flex gap-1">
        {!comment.resolved && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setShowReply(!showReply)}
            >
              <Reply className="mr-1 h-3 w-3" />
              Reply
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => resolveComment({ commentId: comment._id })}
            >
              <Check className="mr-1 h-3 w-3" />
              Resolve
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-destructive"
          onClick={() => deleteComment({ commentId: comment._id })}
        >
          <Trash2 className="mr-1 h-3 w-3" />
        </Button>
      </div>

      {/* Reply input */}
      {showReply && (
        <div className="mt-2 space-y-2">
          <Textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            className="min-h-[60px] text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleReply} className="text-xs">
              Reply
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowReply(false)}
              className="text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
