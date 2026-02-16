type EditorPanelProps = {
  title?: string;
};

export function EditorPanel({ title = "Editor panel" }: EditorPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
        {title}
      </div>
      <div className="flex-1 p-4">
        <div className="h-full rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          Rich text editor area (Phase 2 will integrate Tiptap).
        </div>
      </div>
    </div>
  );
}
