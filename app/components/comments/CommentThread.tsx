import type { CommentRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";

type CommentThreadProps = {
  comment: CommentRecord;
  replies: CommentRecord[];
  onResolve: (commentId: string) => void;
};

export function CommentThread({ comment, replies, onResolve }: CommentThreadProps) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-3 text-sm">
      <div className="mb-1 text-xs text-slate-500">
        Anchor: {comment.anchorText || "No anchor text"}
      </div>
      <p className="text-slate-800">{comment.content}</p>
      <div className="mt-2 flex justify-between">
        <span className="text-xs text-slate-500">
          {comment.resolved ? "Resolved" : "Open"}
        </span>
        {!comment.resolved ? (
          <Button size="sm" variant="secondary" onClick={() => onResolve(comment.id)}>
            Resolve
          </Button>
        ) : null}
      </div>
      {replies.length > 0 ? (
        <div className="mt-2 space-y-1 border-l border-slate-200 pl-2">
          {replies.map((reply) => (
            <p key={reply.id} className="text-xs text-slate-700">
              ↳ {reply.content}
            </p>
          ))}
        </div>
      ) : null}
    </article>
  );
}
