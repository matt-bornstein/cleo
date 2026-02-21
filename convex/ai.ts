import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const AI_LOCK_TIMEOUT = 120000; // 120 seconds

export const acquireLock = mutation({
  args: { documentId: v.id("documents") },
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

    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");

    const now = Date.now();

    // Check if already locked by another user
    if (
      doc.aiLockedBy &&
      doc.aiLockedBy !== userId &&
      doc.aiLockedAt &&
      now - doc.aiLockedAt < AI_LOCK_TIMEOUT
    ) {
      const lockingUser = await ctx.db.get(doc.aiLockedBy);
      throw new Error(
        `AI is already processing a request from ${lockingUser?.name || lockingUser?.email || "another user"}`
      );
    }

    // Acquire lock
    await ctx.db.patch(args.documentId, {
      aiLockedBy: userId,
      aiLockedAt: now,
    });
  },
});

export const releaseLock = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const doc = await ctx.db.get(args.documentId);
    if (!doc) return;

    // Only the lock holder can release (or if lock is stale)
    if (doc.aiLockedBy === userId || !doc.aiLockedAt || Date.now() - doc.aiLockedAt >= AI_LOCK_TIMEOUT) {
      await ctx.db.patch(args.documentId, {
        aiLockedBy: undefined,
        aiLockedAt: undefined,
      });
    }
  },
});

export const saveMessage = mutation({
  args: {
    documentId: v.id("documents"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    model: v.optional(v.string()),
    diffId: v.optional(v.id("diffs")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("aiMessages", {
      documentId: args.documentId,
      userId,
      role: args.role,
      content: args.content,
      model: args.model,
      diffId: args.diffId,
      createdAt: Date.now(),
    });
  },
});

export const getMessages = query({
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

    const doc = await ctx.db.get(args.documentId);
    if (!doc) return [];

    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Filter out cleared messages
    const filtered = doc.chatClearedAt
      ? messages.filter((m) => m.createdAt > doc.chatClearedAt!)
      : messages;

    // Enrich with user info
    const enriched = await Promise.all(
      filtered.map(async (msg) => {
        let userName = msg.role === "assistant" ? "AI" : "Unknown";
        if (msg.userId) {
          const user = await ctx.db.get(msg.userId);
          if (user) {
            userName =
              (user as any).name ||
              (user as any).email ||
              userName;
          }
        }
        return { ...msg, userName };
      })
    );

    return enriched;
  },
});

export const clearChat = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.patch(args.documentId, {
      chatClearedAt: Date.now(),
    });
  },
});

// Internal functions for use by HTTP actions (no auth checks)
export const getMessagesInternal = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const doc = await ctx.db.get(args.documentId);
    const filtered = doc?.chatClearedAt
      ? messages.filter((m) => m.createdAt > doc.chatClearedAt!)
      : messages;

    return filtered;
  },
});

export const saveMessageInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("aiMessages", {
      documentId: args.documentId,
      role: args.role,
      content: args.content,
      model: args.model,
      createdAt: Date.now(),
    });
  },
});

export const setRenderedPromptInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    renderedPrompt: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .collect();

    const latestUserMsg = messages.find((m) => m.role === "user");
    if (latestUserMsg) {
      await ctx.db.patch(latestUserMsg._id, {
        renderedPrompt: args.renderedPrompt,
      });
    }
  },
});

export const releaseLockInternal = internalMutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return;
    await ctx.db.patch(args.documentId, {
      aiLockedBy: undefined,
      aiLockedAt: undefined,
    });
  },
});
