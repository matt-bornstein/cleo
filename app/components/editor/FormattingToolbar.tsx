"use client";

import type { Editor } from "@tiptap/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FormattingToolbarProps = {
  editor: unknown;
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
  const normalizedEditor = isEditorLike(editor) ? editor : null;

  if (!normalizedEditor) {
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
        onClick={() =>
          runToolbarAction(() => normalizedEditor.chain().focus().toggleBold().run())
        }
        isActive={normalizedEditor.isActive("bold")}
      />
      <ToolbarAction
        label="I"
        onClick={() =>
          runToolbarAction(() => normalizedEditor.chain().focus().toggleItalic().run())
        }
        isActive={normalizedEditor.isActive("italic")}
      />
      <ToolbarAction
        label="U"
        onClick={() =>
          runToolbarAction(() =>
            normalizedEditor.chain().focus().toggleUnderline().run(),
          )
        }
        isActive={normalizedEditor.isActive("underline")}
      />
      <ToolbarAction
        label="S"
        onClick={() =>
          runToolbarAction(() => normalizedEditor.chain().focus().toggleStrike().run())
        }
        isActive={normalizedEditor.isActive("strike")}
      />
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <ToolbarAction
        label="H1"
        onClick={() =>
          runToolbarAction(() =>
            normalizedEditor.chain().focus().toggleHeading({ level: 1 }).run(),
          )
        }
        isActive={normalizedEditor.isActive("heading", { level: 1 })}
      />
      <ToolbarAction
        label="H2"
        onClick={() =>
          runToolbarAction(() =>
            normalizedEditor.chain().focus().toggleHeading({ level: 2 }).run(),
          )
        }
        isActive={normalizedEditor.isActive("heading", { level: 2 })}
      />
      <ToolbarAction
        label="H3"
        onClick={() =>
          runToolbarAction(() =>
            normalizedEditor.chain().focus().toggleHeading({ level: 3 }).run(),
          )
        }
        isActive={normalizedEditor.isActive("heading", { level: 3 })}
      />
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <ToolbarAction
        label="• List"
        onClick={() =>
          runToolbarAction(() =>
            normalizedEditor.chain().focus().toggleBulletList().run(),
          )
        }
        isActive={normalizedEditor.isActive("bulletList")}
      />
      <ToolbarAction
        label="1. List"
        onClick={() =>
          runToolbarAction(() =>
            normalizedEditor.chain().focus().toggleOrderedList().run(),
          )
        }
        isActive={normalizedEditor.isActive("orderedList")}
      />
      <ToolbarAction
        label="Task"
        onClick={() =>
          runToolbarAction(() =>
            normalizedEditor.chain().focus().toggleTaskList().run(),
          )
        }
        isActive={normalizedEditor.isActive("taskList")}
      />
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <ToolbarAction
        label="Code"
        onClick={() =>
          runToolbarAction(() =>
            normalizedEditor.chain().focus().toggleCodeBlock().run(),
          )
        }
        isActive={normalizedEditor.isActive("codeBlock")}
      />
      <ToolbarAction
        label="Quote"
        onClick={() =>
          runToolbarAction(() =>
            normalizedEditor.chain().focus().toggleBlockquote().run(),
          )
        }
        isActive={normalizedEditor.isActive("blockquote")}
      />
      <ToolbarAction
        label="Rule"
        onClick={() =>
          runToolbarAction(() =>
            normalizedEditor.chain().focus().setHorizontalRule().run(),
          )
        }
      />
      <ToolbarAction
        label="Table"
        onClick={() =>
          runToolbarAction(() =>
            normalizedEditor
              .chain()
              .focus()
              .insertTable({ rows: 2, cols: 2, withHeaderRow: true })
              .run(),
          )
        }
      />
    </div>
  );
}

function runToolbarAction(action: () => void) {
  try {
    action();
  } catch {
    // Ignore malformed editor command wiring at runtime.
  }
}

function isEditorLike(value: unknown): value is Editor {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    chain?: unknown;
    isActive?: unknown;
  };
  return typeof candidate.chain === "function" && typeof candidate.isActive === "function";
}
