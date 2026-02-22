"use client";

import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import {
  EditorProvider,
  useCurrentEditor,
} from "@tiptap/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { editorExtensions } from "@/lib/editor/extensions";
import {
  RemoteCursorsExtension,
  remoteCursorsState,
  type RemoteCursor,
} from "@/lib/editor/remoteCursors";
import {
  CommentHighlightsExtension,
  commentHighlightsState,
  type CommentAnchor,
} from "@/lib/editor/commentHighlights";
import { DiffHighlightsExtension } from "@/lib/editor/diffHighlights";
import { FormattingToolbar } from "./FormattingToolbar";
import { Ruler } from "./Ruler";
import { useIdleSave } from "@/hooks/useIdleSave";
import { usePresence } from "@/hooks/usePresence";
import { useEditorContext } from "./EditorContext";
import { useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import type { Editor } from "@tiptap/react";

/**
 * Dispatch a no-op transaction to force ProseMirror to recompute decorations.
 */
function triggerDecorationRefresh(editor: Editor | null) {
  if (editor && !editor.isDestroyed) {
    // setMeta triggers apply() in all plugins without changing content
    const tr = editor.state.tr.setMeta("decorationRefresh", true);
    editor.view.dispatch(tr);
  }
}

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
  const comments = useQuery(api.comments.list, { documentId });

  // Update the shared mutable cursor state and trigger editor refresh
  const editorRefForDecorations = useRef<any>(null);

  useEffect(() => {
    remoteCursorsState.cursors = othersPresence.map((p) => ({
      visitorId: p.visitorId,
      userName: p.userName ?? "Anonymous",
      color: (p.data as any)?.color ?? "#888",
      cursor: (p.data as any)?.cursor,
      selection: (p.data as any)?.selection,
    }));
    // Trigger a dummy transaction to force decoration recompute
    triggerDecorationRefresh(editorRefForDecorations.current);
  }, [othersPresence]);

  // Update the shared mutable comment state
  useEffect(() => {
    if (!comments) {
      commentHighlightsState.comments = [];
    } else {
      commentHighlightsState.comments = comments
        .filter((c) => !c.parentCommentId)
        .map((c) => ({
          id: c._id,
          anchorFrom: c.anchorFrom,
          anchorTo: c.anchorTo,
          anchorText: c.anchorText,
          resolved: c.resolved,
        }));
    }
    triggerDecorationRefresh(editorRefForDecorations.current);
  }, [comments]);

  // Extensions are stable — they don't change when cursor/comment data updates.
  // The plugins read from the shared mutable refs instead.
  const allExtensions = useMemo(
    () => [
      ...editorExtensions,
      syncExtension,
      RemoteCursorsExtension,
      CommentHighlightsExtension,
      DiffHighlightsExtension,
    ],
    [syncExtension]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EditorProvider
        immediatelyRender={false}
        content={initialContent}
        extensions={allExtensions}
        editorContainerProps={{
          className: "min-h-0 flex-1 overflow-y-auto",
        }}
        onUpdate={({ editor }) => {
          const json = JSON.stringify(editor.getJSON());
          scheduleIdleSave(json);
        }}
        onSelectionUpdate={({ editor }) => {
          const { from, to } = editor.state.selection;
          updateMyPresence({
            cursor: from,
            selection: from !== to ? { from, to } : undefined,
          });
        }}
        editorProps={{
          attributes: {
            class:
              "tiptap-content focus:outline-none pl-12 pr-8 py-4 max-w-5xl",
          },
        }}
      >
        <EditorToolbar documentId={documentId} editorRef={editorRefForDecorations} />
      </EditorProvider>
    </div>
  );
}

function EditorToolbar({
  documentId,
  editorRef,
}: {
  documentId: Id<"documents">;
  editorRef: React.MutableRefObject<Editor | null>;
}) {
  const { editor } = useCurrentEditor();
  const { setEditor } = useEditorContext();

  useEffect(() => {
    editorRef.current = editor;
    setEditor(editor);
    return () => {
      editorRef.current = null;
      setEditor(null);
    };
  }, [editor, setEditor, editorRef]);

  if (!editor) return null;
  return (
    <>
      <FormattingToolbar editor={editor} documentId={documentId} />
      <Ruler leftOffset={48} />
    </>
  );
}
