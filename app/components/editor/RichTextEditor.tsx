"use client";

import { useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";

import { FormattingToolbar } from "@/components/editor/FormattingToolbar";
import { editorExtensions } from "@/lib/editor/extensions";
import { useOptionalTiptapSync } from "@/hooks/useOptionalTiptapSync";

type RichTextEditorProps = {
  documentId: unknown;
  content: unknown;
  onContentChange: unknown;
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

function readEditorJsonString(editor: unknown) {
  if (!editor || typeof editor !== "object") {
    return undefined;
  }

  let getJSON: unknown;
  try {
    getJSON = (editor as { getJSON?: unknown }).getJSON;
  } catch {
    return undefined;
  }

  if (typeof getJSON !== "function") {
    return undefined;
  }

  try {
    return JSON.stringify(Reflect.apply(getJSON, editor, []));
  } catch {
    return undefined;
  }
}

function safeOnContentChange(onContentChange: unknown, nextContent: string) {
  if (typeof onContentChange !== "function") {
    return;
  }

  try {
    onContentChange(nextContent);
  } catch {
    return;
  }
}

function safeOnLocalUpdate(onLocalUpdate: unknown) {
  if (typeof onLocalUpdate !== "function") {
    return;
  }

  try {
    onLocalUpdate();
  } catch {
    return;
  }
}

function safeAreContentsEqual(currentContent: unknown, nextContent: JSONContent) {
  try {
    return JSON.stringify(currentContent) === JSON.stringify(nextContent);
  } catch {
    return false;
  }
}

function safeReadEditorJson(editor: unknown) {
  if (!editor || typeof editor !== "object" || !("getJSON" in editor)) {
    return undefined;
  }

  try {
    const getJSON = (editor as { getJSON?: unknown }).getJSON;
    if (typeof getJSON !== "function") {
      return undefined;
    }
    return Reflect.apply(getJSON, editor, []) as JSONContent;
  } catch {
    return undefined;
  }
}

function safeSetEditorContent(editor: unknown, nextContent: JSONContent) {
  if (!editor || typeof editor !== "object" || !("commands" in editor)) {
    return;
  }

  try {
    const commands = (editor as { commands?: unknown }).commands;
    if (!commands || typeof commands !== "object" || !("setContent" in commands)) {
      return;
    }
    const setContent = (commands as { setContent?: unknown }).setContent;
    if (typeof setContent !== "function") {
      return;
    }
    Reflect.apply(setContent, commands, [nextContent, false]);
  } catch {
    return;
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
          "prose prose-slate max-w-none min-h-[400px] rounded-b-md bg-white p-4 focus:outline-none [&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-tight [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-tight [&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:leading-tight [&_h5]:mt-3 [&_h5]:mb-1 [&_h5]:text-base [&_h5]:font-semibold [&_h6]:mt-3 [&_h6]:mb-1 [&_h6]:text-base [&_h6]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li]:pl-1",
      },
    },
    editable,
    onUpdate: ({ editor: nextEditor }) => {
      const nextContent = readEditorJsonString(nextEditor);
      if (typeof nextContent === "string") {
        safeOnContentChange(onContentChange, nextContent);
      }
      safeOnLocalUpdate(onLocalUpdate);
    },
  });

  useEffect(() => {
    const currentContent = safeReadEditorJson(editor);
    if (safeAreContentsEqual(currentContent, parsedContent)) {
      return;
    }
    safeSetEditorContent(editor, parsedContent);
  }, [editor, parsedContent]);

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
          "prose prose-slate max-w-none min-h-[400px] rounded-b-md bg-white p-4 focus:outline-none [&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-tight [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-tight [&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:leading-tight [&_h5]:mt-3 [&_h5]:mb-1 [&_h5]:text-base [&_h5]:font-semibold [&_h6]:mt-3 [&_h6]:mb-1 [&_h6]:text-base [&_h6]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li]:pl-1",
      },
    },
    editable,
    onUpdate: ({ editor: nextEditor }) => {
      const nextContent = readEditorJsonString(nextEditor);
      if (typeof nextContent === "string") {
        safeOnContentChange(onContentChange, nextContent);
      }
      safeOnLocalUpdate(onLocalUpdate);
    },
  });

  useEffect(() => {
    // Collaborative extension owns document state; avoid stomping synced updates.
    if (sync.extension) {
      return;
    }
    const currentContent = safeReadEditorJson(editor);
    if (safeAreContentsEqual(currentContent, parsedContent)) {
      return;
    }
    safeSetEditorContent(editor, parsedContent);
  }, [editor, parsedContent, sync.extension]);

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
