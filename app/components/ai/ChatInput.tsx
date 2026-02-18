"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type ChatInputProps = {
  disabled?: boolean;
  onSubmit: unknown;
};

export function ChatInput({ disabled, onSubmit }: ChatInputProps) {
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const restoreFocusRef = useRef(false);

  const scheduleFocusRestore = useCallback(() => {
    if (!restoreFocusRef.current) {
      return;
    }

    const focusInput = () => {
      const textarea = textareaRef.current;
      if (!textarea || textarea.disabled) {
        return;
      }

      try {
        textarea.focus({ preventScroll: true });
      } catch {
        textarea.focus();
      }
      restoreFocusRef.current = false;
    };

    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      focusInput();
      return;
    }

    window.requestAnimationFrame(() => {
      focusInput();
    });
  }, []);

  useEffect(() => {
    if (!restoreFocusRef.current || disabled) {
      return;
    }
    scheduleFocusRestore();
  }, [disabled, scheduleFocusRestore]);

  const submitPrompt = useCallback(async () => {
    if (disabled) return;
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) return;
    if (typeof onSubmit !== "function") {
      return;
    }
    const previousPrompt = prompt;
    restoreFocusRef.current = true;
    setPrompt("");
    try {
      await onSubmit(normalizedPrompt);
    } catch {
      setPrompt((currentPrompt) =>
        currentPrompt.length === 0 ? previousPrompt : currentPrompt,
      );
    } finally {
      scheduleFocusRestore();
    }
  }, [disabled, onSubmit, prompt, scheduleFocusRestore]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submitPrompt();
    },
    [submitPrompt],
  );

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        value={prompt}
        disabled={disabled}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Ask AI to edit this document..."
        className="min-h-[84px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submitPrompt();
          }
        }}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={disabled}>
          {disabled ? "Working..." : "Send"}
        </Button>
      </div>
    </form>
  );
}
