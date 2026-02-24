import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { prosemirrorSync } from "./prosemirrorSync";

const EMPTY_DOC_OBJ = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const EMPTY_DOC = JSON.stringify(EMPTY_DOC_OBJ);

export const create = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    const documentId = await ctx.db.insert("documents", {
      title: args.title,
      titleSet: false,
      content: EMPTY_DOC,
      createdAt: now,
      updatedAt: now,
    });

    // Create owner permission
    await ctx.db.insert("permissions", {
      documentId,
      userId,
      role: "owner",
    });

    // Create initial diff record
    await ctx.db.insert("diffs", {
      documentId,
      userId,
      patch: "",
      snapshotAfter: EMPTY_DOC,
      source: "created",
      createdAt: now,
    });

    // Initialize prosemirror-sync document
    await prosemirrorSync.create(ctx, documentId, EMPTY_DOC_OBJ);

    return documentId;
  },
});

export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const doc = await ctx.db.get(args.id);
    if (!doc) return null;

    // Check permission
    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.id).eq("userId", userId)
      )
      .first();

    if (!permission) return null;

    return { ...doc, myRole: permission.role };
  },
});

/**
 * Extract plain text preview from ProseMirror JSON, capped at maxLength.
 */
function extractPreview(contentJson: string, maxLength = 500): string {
  try {
    const doc = JSON.parse(contentJson);
    const text = extractText(doc);
    return text.length > maxLength ? text.substring(0, maxLength) + "…" : text;
  } catch {
    return "";
  }
}

function extractText(node: any): string {
  if (node.text) return node.text;
  if (node.type === "hardBreak") return " ";
  if (!node.content) return "";
  const blockTypes = new Set([
    "doc", "paragraph", "heading", "bulletList", "orderedList",
    "listItem", "blockquote", "codeBlock", "table", "tableRow",
  ]);
  const separator = blockTypes.has(node.type) ? " " : "";
  return node.content
    .map((child: any) => extractText(child))
    .filter((t: string) => t.length > 0)
    .join(separator);
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const permissions = await ctx.db
      .query("permissions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const docs = await Promise.all(
      permissions.map(async (perm) => {
        const doc = await ctx.db.get(perm.documentId);
        if (!doc || doc.deletedAt) return null;
        return {
          _id: doc._id,
          title: doc.title,
          preview: extractPreview(doc.content),
          updatedAt: doc.updatedAt,
          createdAt: doc.createdAt,
          role: perm.role,
        };
      })
    );

    return docs
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const updateTitle = mutation({
  args: {
    id: v.id("documents"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.id).eq("userId", userId)
      )
      .first();

    if (!permission || (permission.role !== "owner" && permission.role !== "editor")) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.id, {
      title: args.title,
      titleSet: true,
      updatedAt: Date.now(),
    });
  },
});

export const updateContent = mutation({
  args: {
    id: v.id("documents"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.id).eq("userId", userId)
      )
      .first();

    if (!permission || (permission.role !== "owner" && permission.role !== "editor")) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.id, {
      content: args.content,
      updatedAt: Date.now(),
    });
  },
});

export const softDelete = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.id).eq("userId", userId)
      )
      .first();

    if (!permission || permission.role !== "owner") {
      throw new Error("Only owner can delete");
    }

    await ctx.db.patch(args.id, { deletedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.id).eq("userId", userId)
      )
      .first();

    if (!permission || permission.role !== "owner") {
      throw new Error("Only owner can delete");
    }

    // Delete all permissions
    const allPerms = await ctx.db
      .query("permissions")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .collect();
    for (const perm of allPerms) {
      await ctx.db.delete(perm._id);
    }

    // Delete all diffs
    const allDiffs = await ctx.db
      .query("diffs")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .collect();
    for (const diff of allDiffs) {
      await ctx.db.delete(diff._id);
    }

    // Delete all comments
    const allComments = await ctx.db
      .query("comments")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .collect();
    for (const comment of allComments) {
      await ctx.db.delete(comment._id);
    }

    // Delete all AI messages
    const allMessages = await ctx.db
      .query("aiMessages")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .collect();
    for (const msg of allMessages) {
      await ctx.db.delete(msg._id);
    }

    // Delete all presence
    const allPresence = await ctx.db
      .query("presence")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .collect();
    for (const p of allPresence) {
      await ctx.db.delete(p._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Internal functions for use by HTTP actions (no auth checks)
export const getInternal = internalQuery({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const updateContentInternal = internalMutation({
  args: {
    id: v.id("documents"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      content: args.content,
      updatedAt: Date.now(),
    });
  },
});
