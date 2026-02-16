"use client";

import { FormEvent, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";

type ChatInputProps = {
  disabled?: boolean;
  onSubmit: unknown;
};

export function ChatInput({ disabled, onSubmit }: ChatInputProps) {
  const [prompt, setPrompt] = useState("");

  const submitPrompt = useCallback(async () => {
    if (disabled) return;
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) return;
    if (typeof onSubmit !== "function") {
      return;
    }
    const previousPrompt = prompt;
    setPrompt("");
    try {
      await onSubmit(normalizedPrompt);
    } catch {
      setPrompt((currentPrompt) =>
        currentPrompt.length === 0 ? previousPrompt : currentPrompt,
      );
    }
  }, [disabled, onSubmit, prompt]);

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
