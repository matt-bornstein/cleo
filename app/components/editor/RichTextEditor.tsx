"use client";

import { useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";

import { FormattingToolbar } from "@/components/editor/FormattingToolbar";
import { editorExtensions } from "@/lib/editor/extensions";

type RichTextEditorProps = {
  content: string;
  onContentChange: (content: string) => void;
  onLocalUpdate?: () => void;
  fontSize?: number;
  lineSpacing?: number;
};

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

export function RichTextEditor({
  content,
  onContentChange,
  onLocalUpdate,
  fontSize,
  lineSpacing,
}: RichTextEditorProps) {
  const parsedContent = useMemo(() => parseContent(content), [content]);

  const editor = useEditor({
    extensions: editorExtensions,
    content: parsedContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-slate max-w-none min-h-[400px] rounded-b-md bg-white p-4 focus:outline-none",
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      onContentChange(JSON.stringify(nextEditor.getJSON()));
      onLocalUpdate?.();
    },
  });

  return (
    <div className="flex h-full flex-col">
      <FormattingToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto bg-white">
        <EditorContent
          editor={editor}
          style={{
            fontSize: fontSize ? `${fontSize}px` : undefined,
            lineHeight: lineSpacing ? String(lineSpacing) : undefined,
          }}
        />
      </div>
    </div>
  );
}
