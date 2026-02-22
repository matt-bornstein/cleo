"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { prosemirrorSync } from "./prosemirrorSync";
import { getServerSchema } from "./lib/schema";
import { Node } from "@tiptap/pm/model";
import { Transform } from "@tiptap/pm/transform";

/**
 * Undo or reapply an AI edit.
 *
 * - Undo (default): restores the document to its pre-AI state (snapshotBefore).
 * - Reapply (reapply=true): restores the AI-edited state (snapshotAfter).
 *
 * This is an action (not a mutation) because it needs to call
 * prosemirrorSync.transform() to update the live collaborative editor state —
 * the same mechanism used by http.ts to apply AI edits.
 *
 * Kept in its own "use node" file so the Tiptap/ProseMirror imports don't
 * break the V8 isolate runtime used by queries and mutations in diffs.ts.
 */
/**
 * Restore the document to the state it was in when a particular chat message
 * was submitted, and delete that message plus all subsequent messages.
 */
export const restoreToMessage = action({
  args: {
    documentId: v.id("documents"),
    messageId: v.id("aiMessages"),
  },
  handler: async (ctx, args) => {
    // Get restore data and verify auth/permissions
    const data = await ctx.runQuery(internal.ai.getRestoreDataInternal, {
      documentId: args.documentId,
      messageId: args.messageId,
    });

    // Update the ProseMirror sync state
    const restoreDoc = JSON.parse(data.restoreContent);
    const schema = getServerSchema();
    await prosemirrorSync.transform(ctx, args.documentId, schema, (currentDoc) => {
      const targetDoc = Node.fromJSON(schema, restoreDoc);
      const tr = new Transform(currentDoc);
      tr.replaceWith(0, currentDoc.content.size, targetDoc.content);
      if (tr.steps.length === 0) return null;
      return tr;
    });

    // Update the documents table and create a diff record
    await ctx.runMutation(internal.diffs.applyRestoreInternal, {
      documentId: args.documentId,
      userId: data.userId,
      restoreContent: data.restoreContent,
      currentContent: data.currentContent,
    });

    // Delete the message and all messages after it
    await ctx.runMutation(internal.ai.deleteMessagesFromInternal, {
      documentId: args.documentId,
      messageId: args.messageId,
    });
  },
});

export const undoAiEdit = action({
  args: {
    documentId: v.id("documents"),
    diffId: v.id("diffs"),
    reapply: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const isReapply = args.reapply ?? false;

    // Get undo/reapply data and verify auth/permissions
    const data = await ctx.runQuery(internal.diffs.getUndoDataInternal, {
      documentId: args.documentId,
      diffId: args.diffId,
      reapply: isReapply,
    });

    // Update the ProseMirror sync state so the collaborative editor picks up the change
    const restoreDoc = JSON.parse(data.restoreContent);
    const schema = getServerSchema();
    await prosemirrorSync.transform(ctx, args.documentId, schema, (currentDoc) => {
      const targetDoc = Node.fromJSON(schema, restoreDoc);
      const tr = new Transform(currentDoc);
      tr.replaceWith(0, currentDoc.content.size, targetDoc.content);
      if (tr.steps.length === 0) return null;
      return tr;
    });

    // Update the documents table, create diff record, and toggle the undone flag
    await ctx.runMutation(internal.diffs.applyUndoInternal, {
      documentId: args.documentId,
      diffId: args.diffId,
      userId: data.userId,
      restoreContent: data.restoreContent,
      currentContent: data.currentContent,
      undone: !isReapply,
    });
  },
});
