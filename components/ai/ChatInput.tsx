"use client";

import { useState, useRef, KeyboardEvent, forwardRef, useImperativeHandle } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, X } from "lucide-react";

interface ChatInputProps {
  onSubmit: (prompt: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  placeholder?: string;
  leftSlot?: React.ReactNode;
}

export interface ChatInputHandle {
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput({
  onSubmit,
  onCancel,
  disabled = false,
  placeholder = "Ask AI to edit your document...",
  leftSlot,
}, ref) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Enter (without Shift) or Cmd/Ctrl+Enter to send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-1.5 p-3">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[100px] max-h-[180px] resize-none text-sm"
        rows={4}
      />
      <div className="flex items-center justify-between">
        <div>{leftSlot}</div>
        {disabled && onCancel ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!value.trim() || disabled}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
});
