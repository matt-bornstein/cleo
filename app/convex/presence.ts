import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { getOrCreateCurrentUserId } from "./currentUser";

export const update = mutation({
  args: {
    documentId: v.id("documents"),
    visitorId: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const now = safeNow();
    const userId = await getOrCreateCurrentUserId(ctx);
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        documentId: args.documentId,
        data: args.data,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("presence", {
      documentId: args.documentId,
      visitorId: args.visitorId,
      userId,
      data: args.data,
      updatedAt: now,
    });
  },
});

export const heartbeat = mutation({
  args: {
    visitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .unique();

    if (!existing) return null;
    await ctx.db.patch(existing._id, {
      updatedAt: safeNow(),
    });
    return existing._id;
  },
});

export const list = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("presence")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
  },
});

export const remove = mutation({
  args: {
    visitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .unique();
    if (!existing) return null;
    await ctx.db.delete(existing._id);
    return existing._id;
  },
});

export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const threshold = Math.max(0, safeNow() - 60_000);
    const entries = await ctx.db.query("presence").collect();
    const stale = entries.filter((entry) => entry.updatedAt < threshold);
    await Promise.all(stale.map((entry) => ctx.db.delete(entry._id)));
    return stale.length;
  },
});

function safeNow() {
  try {
    return Math.max(0, Date.now());
  } catch {
    return 0;
  }
}
