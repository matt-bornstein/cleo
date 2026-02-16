"use client";

import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { EditorProvider, EditorContent, useCurrentEditor } from "@tiptap/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { editorExtensions } from "@/lib/editor/extensions";
import { FormattingToolbar } from "./FormattingToolbar";
import { useIdleSave } from "@/hooks/useIdleSave";
import { useEffect, useRef } from "react";
import { useEditorContext } from "./EditorContext";

interface CollaborativeEditorProps {
  documentId: Id<"documents">;
}

const EMPTY_DOC = { type: "doc" as const, content: [] };

export function CollaborativeEditor({ documentId }: CollaborativeEditorProps) {
  const sync = useTiptapSync(api.prosemirrorSync, documentId);

  if (sync.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Loading document...</p>
      </div>
    );
  }

  if (sync.initialContent !== null && sync.initialContent !== undefined) {
    return (
      <SyncedEditor
        documentId={documentId}
        initialContent={sync.initialContent}
        syncExtension={sync.extension!}
      />
    );
  }

  // Document doesn't exist in prosemirror-sync yet - create it
  return (
    <CreateSyncDoc
      documentId={documentId}
      onCreate={() => sync.create!(EMPTY_DOC)}
    />
  );
}

function CreateSyncDoc({
  documentId,
  onCreate,
}: {
  documentId: Id<"documents">;
  onCreate: () => Promise<void>;
}) {
  const hasCreated = useRef(false);

  useEffect(() => {
    if (!hasCreated.current) {
      hasCreated.current = true;
      onCreate().catch(console.error);
    }
  }, [onCreate]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-muted-foreground">Initializing document...</p>
    </div>
  );
}

function SyncedEditor({
  documentId,
  initialContent,
  syncExtension,
}: {
  documentId: Id<"documents">;
  initialContent: any;
  syncExtension: any;
}) {
  const { scheduleIdleSave } = useIdleSave(documentId);
  const allExtensions = [...editorExtensions, syncExtension];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <EditorProvider
        content={initialContent}
        extensions={allExtensions}
        onUpdate={({ editor }) => {
          const json = JSON.stringify(editor.getJSON());
          scheduleIdleSave(json);
        }}
        editorProps={{
          attributes: {
            class:
              "tiptap-content focus:outline-none min-h-[calc(100vh-10rem)] px-8 py-4",
          },
        }}
      >
        <EditorToolbar documentId={documentId} />
        <EditorContent editor={null} />
      </EditorProvider>
    </div>
  );
}

function EditorToolbar({ documentId }: { documentId: Id<"documents"> }) {
  const { editor } = useCurrentEditor();
  const { setEditor } = useEditorContext();

  useEffect(() => {
    setEditor(editor);
    return () => setEditor(null);
  }, [editor, setEditor]);

  if (!editor) return null;
  return <FormattingToolbar editor={editor} documentId={documentId} />;
}
