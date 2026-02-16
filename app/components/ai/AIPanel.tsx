"use client";

import { ChatInput } from "@/components/ai/ChatInput";
import { ChatMessages } from "@/components/ai/ChatMessages";
import { ModelSelector } from "@/components/ai/ModelSelector";
import { useAIChat } from "@/hooks/useAIChat";

type AIPanelProps = {
  documentId: string;
  currentDocumentContent: string;
  onApplyContent: (nextContent: string) => void;
};

export function AIPanel({
  documentId,
  currentDocumentContent,
  onApplyContent,
}: AIPanelProps) {
  const {
    messages,
    selectedModel,
    selectedModelLabel,
    setSelectedModel,
    sendPrompt,
    isLoading,
    error,
  } = useAIChat({
    documentId,
    currentDocumentContent,
    onApplyContent,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
        AI Assistant · {selectedModelLabel}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        ) : null}
        <ChatMessages messages={messages} />
      </div>
      <div className="space-y-2 border-t border-slate-200 bg-slate-100 p-3">
        <ModelSelector value={selectedModel} onValueChange={setSelectedModel} />
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <ChatInput disabled={isLoading} onSubmit={sendPrompt} />
        </div>
      </div>
    </div>
  );
}
