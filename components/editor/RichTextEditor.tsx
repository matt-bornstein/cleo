"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { editorExtensions } from "@/lib/editor/extensions";
import { FormattingToolbar } from "./FormattingToolbar";
import { useCallback, useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";

interface RichTextEditorProps {
  initialContent: string;
  onUpdate?: (json: string) => void;
  editable?: boolean;
}

export function RichTextEditor({
  initialContent,
  onUpdate,
  editable = true,
}: RichTextEditorProps) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const handleUpdate = useCallback(
    ({ editor: ed }: { editor: Editor }) => {
      if (onUpdateRef.current) {
        const json = JSON.stringify(ed.getJSON());
        onUpdateRef.current(json);
      }
    },
    []
  );

  const editor = useEditor({
    extensions: editorExtensions,
    content: parseContent(initialContent),
    editable,
    onUpdate: handleUpdate,
    editorProps: {
      attributes: {
        class:
          "tiptap-content focus:outline-none min-h-[calc(100vh-10rem)] px-8 py-4",
      },
    },
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  if (!editor) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Loading editor...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <FormattingToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function parseContent(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    return {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
  }
}
