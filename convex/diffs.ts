import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { prosemirrorJsonToHtml } from "./lib/htmlSerializer";
import { computeHtmlPatch } from "./lib/diffing";

/**
 * Convert ProseMirror JSON string to HTML for diffing.
 */
function contentToHtml(contentJson: string): string {
  try {
    const doc = JSON.parse(contentJson);
    return prosemirrorJsonToHtml(doc);
  } catch {
    return contentJson;
  }
}

export const triggerIdleSave = mutation({
  args: {
    documentId: v.id("documents"),
    content: v.string(), // Current ProseMirror JSON from the editor
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check permission
    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", userId)
      )
      .first();

    if (!permission || (permission.role !== "owner" && permission.role !== "editor")) {
      throw new Error("Not authorized to edit");
    }

    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");

    // Server-side deduplication: skip if a diff was saved within the last 4 seconds
    const now = Date.now();
    if (doc.lastDiffAt && now - doc.lastDiffAt < 4000) {
      return;
    }

    // Get the last diff snapshot for comparison
    const lastDiff = await ctx.db
      .query("diffs")
      .withIndex("by_document_time", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .first();

    const previousContent = lastDiff?.snapshotAfter ?? doc.content;

    // Simple comparison: if content hasn't changed, just update timestamp
    if (args.content === previousContent) {
      await ctx.db.patch(args.documentId, { lastDiffAt: now });
      return;
    }

    // Compute HTML-level diff using diff-match-patch
    const oldHtml = contentToHtml(previousContent);
    const newHtml = contentToHtml(args.content);
    const patch = computeHtmlPatch(oldHtml, newHtml);

    // Save diff record with the actual patch
    await ctx.db.insert("diffs", {
      documentId: args.documentId,
      userId,
      patch,
      snapshotAfter: args.content,
      source: "manual",
      createdAt: now,
    });

    // Update document content cache and timestamps
    await ctx.db.patch(args.documentId, {
      content: args.content,
      updatedAt: now,
      lastDiffAt: now,
    });
  },
});

export const createAiDiff = mutation({
  args: {
    documentId: v.id("documents"),
    content: v.string(), // New ProseMirror JSON
    aiPrompt: v.optional(v.string()),
    aiModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get previous content for diffing
    const doc = await ctx.db.get(args.documentId);
    const previousContent = doc?.content ?? "";

    // Compute HTML-level diff
    const oldHtml = contentToHtml(previousContent);
    const newHtml = contentToHtml(args.content);
    const patch = computeHtmlPatch(oldHtml, newHtml);

    const now = Date.now();
    const diffId = await ctx.db.insert("diffs", {
      documentId: args.documentId,
      userId,
      patch,
      snapshotAfter: args.content,
      source: "ai",
      aiPrompt: args.aiPrompt,
      aiModel: args.aiModel,
      createdAt: now,
    });

    return diffId;
  },
});

export const listByDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Check permission
    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", userId)
      )
      .first();

    if (!permission) return [];

    const diffs = await ctx.db
      .query("diffs")
      .withIndex("by_document_time", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .collect();

    // Enrich with user info
    const enriched = await Promise.all(
      diffs.map(async (diff) => {
        const user = await ctx.db.get(diff.userId);
        return {
          ...diff,
          userName: user?.name ?? user?.email ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});

export const getVersion = query({
  args: { diffId: v.id("diffs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const diff = await ctx.db.get(args.diffId);
    if (!diff) return null;

    // Check permission
    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", diff.documentId).eq("userId", userId)
      )
      .first();

    if (!permission) return null;

    return diff;
  },
});

export const restore = mutation({
  args: {
    documentId: v.id("documents"),
    diffId: v.id("diffs"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check permission
    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", userId)
      )
      .first();

    if (!permission || (permission.role !== "owner" && permission.role !== "editor")) {
      throw new Error("Not authorized");
    }

    const diff = await ctx.db.get(args.diffId);
    if (!diff) throw new Error("Version not found");

    const now = Date.now();

    // Compute a diff for the restore operation
    const doc = await ctx.db.get(args.documentId);
    const previousContent = doc?.content ?? "";
    const oldHtml = contentToHtml(previousContent);
    const newHtml = contentToHtml(diff.snapshotAfter);
    const patch = computeHtmlPatch(oldHtml, newHtml);

    // Create a new diff record for the restore
    await ctx.db.insert("diffs", {
      documentId: args.documentId,
      userId,
      patch,
      snapshotAfter: diff.snapshotAfter,
      source: "manual",
      createdAt: now,
    });

    // Update document content
    await ctx.db.patch(args.documentId, {
      content: diff.snapshotAfter,
      updatedAt: now,
      lastDiffAt: now,
    });
  },
});
