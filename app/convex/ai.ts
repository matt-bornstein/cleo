import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

export const acquireLock = mutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const now = Math.max(0, Date.now());
    const document = (await ctx.db.get(args.documentId)) as
      | { aiLockedBy?: string; aiLockedAt?: number }
      | null;
    if (!document) {
      throw new Error("Document not found.");
    }

    const currentUserId = "dev-user";
    const lockAge = document.aiLockedAt ? now - document.aiLockedAt : Infinity;
    const hasFreshForeignLock =
      document.aiLockedBy &&
      document.aiLockedBy !== currentUserId &&
      lockAge < 120_000;

    if (hasFreshForeignLock) {
      throw new Error("AI is busy.");
    }

    await ctx.db.patch(args.documentId, {
      aiLockedBy: currentUserId,
      aiLockedAt: now,
    });
    return { ok: true };
  },
});

export const releaseLock = mutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      aiLockedBy: undefined,
      aiLockedAt: undefined,
    });
    return { ok: true };
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
    return ctx.db.insert("aiMessages", {
      ...args,
      userId: "dev-user",
      createdAt: Math.max(0, Date.now()),
    });
  },
});

export const getMessages = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("aiMessages")
      .withIndex("by_document", (q: { eq: (field: string, value: unknown) => unknown }) =>
        q.eq("documentId", args.documentId),
      )
      .collect();
  },
});
