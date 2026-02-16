"use client";

import { ChatInput } from "@/components/ai/ChatInput";
import { ChatMessages } from "@/components/ai/ChatMessages";
import { ModelSelector } from "@/components/ai/ModelSelector";
import { useAILockStatus } from "@/hooks/useAILockStatus";
import { useAIChat } from "@/hooks/useAIChat";
import { normalizeAIUserId } from "@/lib/ai/identity";

type AIPanelProps = {
  documentId: unknown;
  currentDocumentContent: unknown;
  onApplyContent: unknown;
  currentUserId: unknown;
  defaultModel?: unknown;
  canEdit?: unknown;
  chatClearedAt?: unknown;
  onClearChat?: unknown;
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
  const normalizedCanEdit = canEdit !== false;
  const lockStatus = normalizeLockStatus(useAILockStatus(documentId));
  const normalizedCurrentUserId = normalizeAIUserId(currentUserId);
  const normalizedLockOwner = lockStatus.lockedBy
    ? normalizeAIUserId(lockStatus.lockedBy)
    : undefined;
  const isLockedByOther =
    lockStatus.locked &&
    normalizedLockOwner &&
    normalizedLockOwner !== normalizedCurrentUserId;

  const aiChatState = useAIChat({
    documentId,
    currentDocumentContent,
    onApplyContent,
    currentUserId: normalizedCurrentUserId,
    defaultModel,
    chatClearedAt,
    onClearChat,
  });
  const messagesValue = readObjectField(aiChatState, "messages");
  const messages = Array.isArray(messagesValue) ? messagesValue : [];
  const selectedModelValue = readObjectField(aiChatState, "selectedModel");
  const selectedModel =
    typeof selectedModelValue === "string" &&
    selectedModelValue.trim().length > 0
      ? selectedModelValue
      : "gpt-4o";
  const selectedModelLabelValue = readObjectField(aiChatState, "selectedModelLabel");
  const selectedModelLabel =
    typeof selectedModelLabelValue === "string" &&
    selectedModelLabelValue.trim().length > 0
      ? selectedModelLabelValue
      : selectedModel;
  const setSelectedModelValue = readObjectField(aiChatState, "setSelectedModel");
  const setSelectedModel =
    typeof setSelectedModelValue === "function"
      ? setSelectedModelValue
      : undefined;
  const sendPromptValue = readObjectField(aiChatState, "sendPrompt");
  const sendPrompt =
    typeof sendPromptValue === "function"
      ? sendPromptValue
      : undefined;
  const isLoading = readObjectField(aiChatState, "isLoading") === true;
  const errorValue = readObjectField(aiChatState, "error");
  const error = typeof errorValue === "string" ? errorValue : null;
  const clearChatValue = readObjectField(aiChatState, "clearChat");
  const clearChat =
    typeof clearChatValue === "function" ? clearChatValue : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
        <span>AI Assistant · {selectedModelLabel}</span>
        <button
          type="button"
          className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          onClick={() => {
            safeInvoke(clearChat);
          }}
          disabled={isLoading || (messages.length === 0 && !error)}
        >
          Clear chat
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLockedByOther ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            AI ({normalizedLockOwner}) is working...
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
        {!normalizedCanEdit ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
            AI edits are disabled for your current role.
          </div>
        ) : null}
        <ModelSelector value={selectedModel} onValueChange={setSelectedModel} />
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <ChatInput
            disabled={isLoading || !normalizedCanEdit || Boolean(isLockedByOther)}
            onSubmit={sendPrompt}
          />
        </div>
      </div>
    </div>
  );
}

function normalizeLockStatus(lockStatus: unknown) {
  if (!lockStatus || typeof lockStatus !== "object") {
    return { locked: false, lockedBy: undefined };
  }

  const locked = readObjectField(lockStatus, "locked");
  const lockedBy = readObjectField(lockStatus, "lockedBy");
  return {
    locked: locked === true,
    lockedBy: typeof lockedBy === "string" ? lockedBy : undefined,
  };
}

function safeInvoke(callback: unknown) {
  if (typeof callback !== "function") {
    return;
  }

  try {
    callback();
  } catch {
    return;
  }
}

function readObjectField(value: unknown, key: string) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  try {
    return (value as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}
