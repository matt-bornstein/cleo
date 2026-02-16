import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const update = mutation({
  args: {
    documentId: v.id("documents"),
    visitorId: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const now = Date.now();

    // Upsert presence entry
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        data: args.data,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("presence", {
        documentId: args.documentId,
        visitorId: args.visitorId,
        userId,
        data: args.data,
        updatedAt: now,
      });
    }
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
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { updatedAt: Date.now() });
    }
  },
});

export const list = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("presence")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Filter stale entries (>10s old)
    const cutoff = Date.now() - 10000;
    const active = entries.filter((e) => e.updatedAt > cutoff);

    // Enrich with user info
    const enriched = await Promise.all(
      active.map(async (entry) => {
        const user = await ctx.db.get(entry.userId);
        return {
          ...entry,
          userName: user?.name ?? user?.email ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});

export const remove = mutation({
  args: { visitorId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const cleanup = mutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 60000; // 60 seconds

    // Get all stale presence records
    const allPresence = await ctx.db.query("presence").collect();
    const stale = allPresence.filter((e) => e.updatedAt < cutoff);

    for (const entry of stale) {
      await ctx.db.delete(entry._id);
    }

    return { deleted: stale.length };
  },
});
