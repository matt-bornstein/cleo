export function AIPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
        AI Assistant
      </div>
      <div className="flex-1 p-4">
        <div className="h-full rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
          AI chat panel (Phase 3 will add messages, model selection, and
          streaming responses).
        </div>
      </div>
    </div>
  );
}
