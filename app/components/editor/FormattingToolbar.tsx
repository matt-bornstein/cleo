"use client";

import type { Editor } from "@tiptap/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FormattingToolbarProps = {
  editor: Editor | null;
};

type ToolbarButton = {
  label: string;
  onClick: () => void;
  isActive?: boolean;
};

function ToolbarAction({ label, onClick, isActive }: ToolbarButton) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={cn("h-8 px-2 text-xs", isActive ? "bg-slate-200 text-slate-900" : "")}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

export function FormattingToolbar({ editor }: FormattingToolbarProps) {
  if (!editor) {
    return (
      <div className="border-b border-slate-200 px-4 py-2 text-xs text-slate-500">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-3 py-2">
      <ToolbarAction
        label="B"
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
      />
      <ToolbarAction
        label="I"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
      />
      <ToolbarAction
        label="U"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
      />
      <ToolbarAction
        label="S"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
      />
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <ToolbarAction
        label="H1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
      />
      <ToolbarAction
        label="H2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
      />
      <ToolbarAction
        label="H3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
      />
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <ToolbarAction
        label="• List"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
      />
      <ToolbarAction
        label="1. List"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
      />
      <ToolbarAction
        label="Task"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
      />
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <ToolbarAction
        label="Code"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive("codeBlock")}
      />
      <ToolbarAction
        label="Quote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
      />
      <ToolbarAction
        label="Rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
      <ToolbarAction
        label="Table"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 2, cols: 2, withHeaderRow: true })
            .run()
        }
      />
    </div>
  );
}
