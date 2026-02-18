"use client";

import { useEffect, useRef, useState } from "react";

import { ChatInput } from "@/components/ai/ChatInput";
import { ChatMessages } from "@/components/ai/ChatMessages";
import { ModelSelector } from "@/components/ai/ModelSelector";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const [debugModalTitle, setDebugModalTitle] = useState("Message details");
  const [debugModalDescription, setDebugModalDescription] = useState("");
  const [debugModalContent, setDebugModalContent] = useState("");
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = messagesScrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages.length]);

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
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
        <div
          ref={messagesScrollRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
        >
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
          <ChatMessages
            messages={messages}
            onSelectMessage={(message: unknown) => {
              const details = buildMessageDebugDetails(message);
              if (!details) {
                return;
              }
              setDebugModalTitle(details.title);
              setDebugModalDescription(details.description);
              setDebugModalContent(details.content);
              setDebugModalOpen(true);
            }}
          />
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
      <Dialog
        open={debugModalOpen}
        onOpenChange={(nextOpen) => {
          setDebugModalOpen(nextOpen);
        }}
      >
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{debugModalTitle}</DialogTitle>
            <DialogDescription>{debugModalDescription}</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3">
            <pre className="whitespace-pre-wrap break-words text-xs text-slate-700">
              {debugModalContent}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function buildMessageDebugDetails(message: unknown) {
  if (!message || typeof message !== "object") {
    return null;
  }

  const role = readObjectField(message, "role");
  if (role === "user") {
    const promptDebug = readObjectField(message, "promptDebug");
    return {
      title: "Full prompt sent to model",
      description:
        "This includes the current document HTML, recent chat history, and your latest user instruction.",
      content:
        typeof promptDebug === "string" && promptDebug.trim().length > 0
          ? promptDebug
          : "Prompt debug details are not available for this message.",
    };
  }

  if (role === "assistant") {
    const rawResponse = readObjectField(message, "rawResponse");
    return {
      title: "Raw model response",
      description:
        "This is the unparsed model output before search/replace parsing and HTML application.",
      content:
        typeof rawResponse === "string" && rawResponse.trim().length > 0
          ? rawResponse
          : "Raw response debug details are not available for this message.",
    };
  }

  return null;
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
