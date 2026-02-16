"use client";

import { useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";

import { FormattingToolbar } from "@/components/editor/FormattingToolbar";
import { editorExtensions } from "@/lib/editor/extensions";
import { useOptionalTiptapSync } from "@/hooks/useOptionalTiptapSync";

type RichTextEditorProps = {
  documentId: string;
  content: unknown;
  onContentChange: (content: string) => void;
  onLocalUpdate?: unknown;
  fontSize?: number;
  lineSpacing?: number;
  editable?: boolean;
};

function parseContent(content: unknown): JSONContent {
  try {
    if (typeof content !== "string") {
      throw new Error("Invalid content payload type.");
    }
    const parsed = JSON.parse(content) as {
      type?: unknown;
      content?: unknown;
    };
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.type !== "doc" ||
      !Array.isArray(parsed.content)
    ) {
      throw new Error("Invalid ProseMirror payload.");
    }
    return parsed as JSONContent;
  } catch {
    return {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
  }
}

export function RichTextEditor({
  documentId,
  content,
  onContentChange,
  onLocalUpdate,
  fontSize,
  lineSpacing,
  editable = true,
}: RichTextEditorProps) {
  const isConvexEnabled = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  if (isConvexEnabled) {
    return (
      <SyncedRichTextEditor
        documentId={documentId}
        content={content}
        onContentChange={onContentChange}
        onLocalUpdate={onLocalUpdate}
        fontSize={fontSize}
        lineSpacing={lineSpacing}
        editable={editable}
      />
    );
  }

  return (
    <LocalRichTextEditor
      content={content}
      onContentChange={onContentChange}
      onLocalUpdate={onLocalUpdate}
      fontSize={fontSize}
      lineSpacing={lineSpacing}
      editable={editable}
    />
  );
}

type InternalEditorProps = Omit<RichTextEditorProps, "documentId">;

function LocalRichTextEditor({
  content,
  onContentChange,
  onLocalUpdate,
  fontSize,
  lineSpacing,
  editable,
}: InternalEditorProps) {
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
    editable,
    onUpdate: ({ editor: nextEditor }) => {
      onContentChange(JSON.stringify(nextEditor.getJSON()));
      if (typeof onLocalUpdate === "function") {
        onLocalUpdate();
      }
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

function SyncedRichTextEditor({
  documentId,
  content,
  onContentChange,
  onLocalUpdate,
  fontSize,
  lineSpacing,
  editable,
}: RichTextEditorProps) {
  const sync = useOptionalTiptapSync(documentId);
  const parsedContent = useMemo(() => parseContent(content), [content]);
  const composedExtensions = useMemo(
    () => (sync.extension ? [...editorExtensions, sync.extension] : [...editorExtensions]),
    [sync.extension],
  );

  const editor = useEditor({
    extensions: composedExtensions,
    content: sync.initialContent ?? parsedContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-slate max-w-none min-h-[400px] rounded-b-md bg-white p-4 focus:outline-none",
      },
    },
    editable,
    onUpdate: ({ editor: nextEditor }) => {
      onContentChange(JSON.stringify(nextEditor.getJSON()));
      if (typeof onLocalUpdate === "function") {
        onLocalUpdate();
      }
    },
  });

  if (sync.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Loading collaborative editor...
      </div>
    );
  }

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
