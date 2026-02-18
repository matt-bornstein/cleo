import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

export const share = mutation({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("editor"),
      v.literal("commenter"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", args.userId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role });
      return existing._id;
    }

    return ctx.db.insert("permissions", args);
  },
});

export const unshare = mutation({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", args.userId),
      )
      .unique();

    if (!existing || existing.role === "owner") {
      return null;
    }

    await ctx.db.delete(existing._id);
    return existing._id;
  },
});

export const getPermissions = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("permissions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
  },
});
