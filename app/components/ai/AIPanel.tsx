"use client";

import { ChatInput } from "@/components/ai/ChatInput";
import { ChatMessages } from "@/components/ai/ChatMessages";
import { ModelSelector } from "@/components/ai/ModelSelector";
import { useAILockStatus } from "@/hooks/useAILockStatus";
import { useAIChat } from "@/hooks/useAIChat";
import { normalizeAIUserId } from "@/lib/ai/identity";

type AIPanelProps = {
  documentId: string;
  currentDocumentContent: string;
  onApplyContent: (nextContent: string) => void;
  currentUserId: string;
  defaultModel?: string;
  canEdit?: boolean;
  chatClearedAt?: number;
  onClearChat?: (clearedAt: number) => void;
};

export function AIPanel({
  documentId,
  currentDocumentContent,
  onApplyContent,
  currentUserId,
  defaultModel,
  canEdit = true,
  chatClearedAt,
  onClearChat,
}: AIPanelProps) {
  const lockStatus = useAILockStatus(documentId);
  const normalizedCurrentUserId = normalizeAIUserId(currentUserId);
  const isLockedByOther =
    lockStatus.locked &&
    lockStatus.lockedBy &&
    lockStatus.lockedBy !== normalizedCurrentUserId;

  const {
    messages,
    selectedModel,
    selectedModelLabel,
    setSelectedModel,
    sendPrompt,
    isLoading,
    error,
    clearChat,
  } = useAIChat({
    documentId,
    currentDocumentContent,
    onApplyContent,
    currentUserId: normalizedCurrentUserId,
    defaultModel,
    chatClearedAt,
    onClearChat,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
        <span>AI Assistant · {selectedModelLabel}</span>
        <button
          type="button"
          className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          onClick={clearChat}
          disabled={isLoading}
        >
          Clear chat
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLockedByOther ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            AI ({lockStatus.lockedBy}) is working...
          </div>
        ) : null}
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        ) : null}
        <ChatMessages messages={messages} />
      </div>
      <div className="space-y-2 border-t border-slate-200 bg-slate-100 p-3">
        {!canEdit ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
            AI edits are disabled for your current role.
          </div>
        ) : null}
        <ModelSelector value={selectedModel} onValueChange={setSelectedModel} />
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <ChatInput
            disabled={isLoading || !canEdit || Boolean(isLockedByOther)}
            onSubmit={sendPrompt}
          />
        </div>
      </div>
    </div>
  );
}
