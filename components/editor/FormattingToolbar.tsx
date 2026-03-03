"use client";

import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  CodeSquare,
  Minus,
  Link,
  Table,
  Undo,
  Redo,
} from "lucide-react";

import { CommentButton } from "./CommentButton";
import { ImageUploadButton } from "./ImageUploadButton";
import { VideoInsertButton } from "./VideoInsertButton";
import { Id } from "@/convex/_generated/dataModel";

interface FormattingToolbarProps {
  editor: Editor;
  documentId?: Id<"documents">;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  icon: React.ReactNode;
  tooltip: string;
  shortcut?: string;
}

function ToolbarButton({
  onClick,
  isActive,
  icon,
  tooltip,
  shortcut,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${isActive ? "bg-accent text-accent-foreground" : ""}`}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {tooltip}
          {shortcut && (
            <span className="ml-2 text-xs text-muted-foreground">
              {shortcut}
            </span>
          )}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function FormattingToolbar({ editor, documentId }: FormattingToolbarProps) {
  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  // Image upload is handled by ImageUploadButton component

  const addTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1 -order-1">
      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        icon={<Undo className="h-4 w-4" />}
        tooltip="Undo"
        shortcut="⌘Z"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        icon={<Redo className="h-4 w-4" />}
        tooltip="Redo"
        shortcut="⌘⇧Z"
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Text Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        icon={<Bold className="h-4 w-4" />}
        tooltip="Bold"
        shortcut="⌘B"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        icon={<Italic className="h-4 w-4" />}
        tooltip="Italic"
        shortcut="⌘I"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        icon={<Underline className="h-4 w-4" />}
        tooltip="Underline"
        shortcut="⌘U"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        icon={<Strikethrough className="h-4 w-4" />}
        tooltip="Strikethrough"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        icon={<Code className="h-4 w-4" />}
        tooltip="Inline Code"
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        icon={<Heading1 className="h-4 w-4" />}
        tooltip="Heading 1"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        icon={<Heading2 className="h-4 w-4" />}
        tooltip="Heading 2"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        icon={<Heading3 className="h-4 w-4" />}
        tooltip="Heading 3"
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        icon={<List className="h-4 w-4" />}
        tooltip="Bullet List"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        icon={<ListOrdered className="h-4 w-4" />}
        tooltip="Ordered List"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        icon={<ListTodo className="h-4 w-4" />}
        tooltip="Task List"
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Block elements */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        icon={<Quote className="h-4 w-4" />}
        tooltip="Blockquote"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive("codeBlock")}
        icon={<CodeSquare className="h-4 w-4" />}
        tooltip="Code Block"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        icon={<Minus className="h-4 w-4" />}
        tooltip="Horizontal Rule"
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Insert */}
      <ToolbarButton
        onClick={addLink}
        isActive={editor.isActive("link")}
        icon={<Link className="h-4 w-4" />}
        tooltip="Insert Link"
      />
      <ImageUploadButton editor={editor} />
      <VideoInsertButton editor={editor} />
      <ToolbarButton
        onClick={addTable}
        icon={<Table className="h-4 w-4" />}
        tooltip="Insert Table"
      />

      {/* Comment */}
      {documentId && (
        <>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <CommentButton editor={editor} documentId={documentId} />
        </>
      )}
    </div>
  );
}
