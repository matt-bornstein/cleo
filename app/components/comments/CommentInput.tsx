"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";

type CommentInputProps = {
  placeholder?: string;
  onSubmit: (value: string) => void;
};

export function CommentInput({ placeholder, onSubmit }: CommentInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = value.trim();
    if (!normalized) return;
    onSubmit(normalized);
    setValue("");
  };

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
        placeholder={placeholder ?? "Write a comment"}
      />
      <div className="flex justify-end">
        <Button size="sm" type="submit">
          Add
        </Button>
      </div>
    </form>
  );
}
