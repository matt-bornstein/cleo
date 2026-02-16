"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";

type ChatInputProps = {
  disabled?: boolean;
  onSubmit: (prompt: string) => Promise<void>;
};

export function ChatInput({ disabled, onSubmit }: ChatInputProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) return;
    const previousPrompt = prompt;
    setPrompt("");
    try {
      await onSubmit(normalizedPrompt);
    } catch {
      setPrompt((currentPrompt) =>
        currentPrompt.length === 0 ? previousPrompt : currentPrompt,
      );
    }
  };

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
            void handleSubmit(event as unknown as FormEvent<HTMLFormElement>);
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
