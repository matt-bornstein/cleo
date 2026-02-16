import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { RemoteCursors } from "@/components/editor/RemoteCursors";
import { hasControlChars } from "@/lib/validators/controlChars";

type EditorPanelProps = {
  documentId: unknown;
  title?: unknown;
  content: unknown;
  onContentChange: unknown;
  onLocalUpdate?: unknown;
  saveStateLabel?: unknown;
  otherPresence?: unknown;
  fontSize?: unknown;
  lineSpacing?: unknown;
  readOnly?: unknown;
};

export function EditorPanel({
  documentId,
  title = "Editor panel",
  content,
  onContentChange,
  onLocalUpdate,
  saveStateLabel,
  otherPresence = [],
  fontSize,
  lineSpacing,
  readOnly = false,
}: EditorPanelProps) {
  const normalizedTitle =
    typeof title === "string" && title.trim().length > 0 && !hasControlChars(title.trim())
      ? title.trim()
      : "Editor panel";
  const normalizedSaveStateLabel =
    typeof saveStateLabel === "string" && !hasControlChars(saveStateLabel)
      ? saveStateLabel
      : "";
  const normalizedFontSize =
    typeof fontSize === "number" && Number.isFinite(fontSize) && fontSize > 0
      ? fontSize
      : undefined;
  const normalizedLineSpacing =
    typeof lineSpacing === "number" &&
    Number.isFinite(lineSpacing) &&
    lineSpacing > 0
      ? lineSpacing
      : undefined;
  const normalizedReadOnly = readOnly === true;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm">
        <span className="font-medium text-slate-600">{normalizedTitle}</span>
        <span className="text-xs text-slate-500">{normalizedSaveStateLabel}</span>
      </div>
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
        <RemoteCursors others={otherPresence} />
      </div>
      {normalizedReadOnly ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Read-only mode. You have view/comment access only.
        </div>
      ) : null}
      <div className="flex-1 overflow-hidden">
        <RichTextEditor
          documentId={documentId}
          content={content}
          onContentChange={(nextContent: string) => {
            safeOnContentChange(onContentChange, nextContent);
          }}
          onLocalUpdate={onLocalUpdate}
          fontSize={normalizedFontSize}
          lineSpacing={normalizedLineSpacing}
          editable={!normalizedReadOnly}
        />
      </div>
    </div>
  );
}

function safeOnContentChange(onContentChange: unknown, nextContent: string) {
  if (typeof onContentChange !== "function") {
    return;
  }

  try {
    onContentChange(nextContent);
  } catch {
    return;
  }
}
