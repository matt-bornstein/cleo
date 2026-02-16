"use client";

import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import {
  EditorProvider,
  EditorContent,
  useCurrentEditor,
} from "@tiptap/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { editorExtensions } from "@/lib/editor/extensions";
import { RemoteCursorsExtension, type RemoteCursor } from "@/lib/editor/remoteCursors";
import { FormattingToolbar } from "./FormattingToolbar";
import { useIdleSave } from "@/hooks/useIdleSave";
import { usePresence } from "@/hooks/usePresence";
import { useEditorContext } from "./EditorContext";
import { useEffect, useRef, useMemo } from "react";
import { useQuery } from "convex/react";

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

  // Document doesn't exist in prosemirror-sync yet — create it
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
  const me = useQuery(api.users.me);
  const userName = me?.name ?? me?.email ?? "Anonymous";
  const { othersPresence, updateMyPresence } = usePresence(documentId, userName);

  // Build remote cursor data from presence
  const remoteCursors: RemoteCursor[] = useMemo(() => {
    return othersPresence.map((p) => ({
      visitorId: p.visitorId,
      userName: p.userName ?? "Anonymous",
      color: (p.data as any)?.color ?? "#888",
      cursor: (p.data as any)?.cursor,
      selection: (p.data as any)?.selection,
    }));
  }, [othersPresence]);

  // Create the remote cursors extension instance with current cursor data
  const remoteCursorsExt = useMemo(
    () =>
      RemoteCursorsExtension.configure({
        cursors: remoteCursors,
      }),
    [remoteCursors]
  );

  const allExtensions = useMemo(
    () => [...editorExtensions, syncExtension, remoteCursorsExt],
    [syncExtension, remoteCursorsExt]
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <EditorProvider
        content={initialContent}
        extensions={allExtensions}
        onUpdate={({ editor }) => {
          const json = JSON.stringify(editor.getJSON());
          scheduleIdleSave(json);
        }}
        onSelectionUpdate={({ editor }) => {
          // Broadcast cursor/selection to other collaborators
          const { from, to } = editor.state.selection;
          updateMyPresence({
            cursor: from,
            selection: from !== to ? { from, to } : undefined,
          });
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
