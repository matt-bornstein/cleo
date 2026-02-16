import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { RemoteCursors } from "@/components/editor/RemoteCursors";
import type { PresenceRecord } from "@/lib/types";

type EditorPanelProps = {
  title?: string;
  content: string;
  onContentChange: (content: string) => void;
  onLocalUpdate?: () => void;
  saveStateLabel?: string;
  otherPresence?: PresenceRecord[];
};

export function EditorPanel({
  title = "Editor panel",
  content,
  onContentChange,
  onLocalUpdate,
  saveStateLabel,
  otherPresence = [],
}: EditorPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm">
        <span className="font-medium text-slate-600">{title}</span>
        <span className="text-xs text-slate-500">{saveStateLabel}</span>
      </div>
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
        <RemoteCursors others={otherPresence} />
      </div>
      <div className="flex-1 overflow-hidden">
        <RichTextEditor
          content={content}
          onContentChange={onContentChange}
          onLocalUpdate={onLocalUpdate}
        />
      </div>
    </div>
  );
}
