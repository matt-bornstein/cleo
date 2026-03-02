"use client";

import { useState, useRef, KeyboardEvent, ClipboardEvent, forwardRef, useImperativeHandle } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, X, ArrowDownToLine } from "lucide-react";

interface ChatInputProps {
  onSubmit: (text: string, attachments: string[]) => void;
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
  const [attachedItems, setAttachedItems] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text/plain");
    if (text.length >= 500) {
      e.preventDefault();
      setAttachedItems((prev) => [...prev, text]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const inlineAttachment = (index: number) => {
    const text = attachedItems[index];
    setValue((prev) => (prev ? prev + "\n" + text : text));
    removeAttachment(index);
  };

  const handleSubmit = () => {
    const hasText = value.trim().length > 0;
    const hasAttachments = attachedItems.length > 0;
    if ((!hasText && !hasAttachments) || disabled) return;

    onSubmit(value.trim(), attachedItems);
    setValue("");
    setAttachedItems([]);
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
      {attachedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachedItems.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs"
            >
              <span className="max-w-[200px] truncate">
                {item.length > 50 ? item.slice(0, 50) + "..." : item}
              </span>
              <button
                type="button"
                onClick={() => inlineAttachment(i)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                title="Insert into textarea"
              >
                <ArrowDownToLine className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
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
            disabled={(!value.trim() && attachedItems.length === 0) || disabled}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
});
