import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("folders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
      .then((folders) => folders.sort((a, b) => a.name.localeCompare(b.name)));
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("folders", {
      name: args.name,
      userId,
      createdAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: { id: v.id("folders"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const folder = await ctx.db.get(args.id);
    if (!folder || folder.userId !== userId) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.id, { name: args.name });
  },
});

export const remove = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const folder = await ctx.db.get(args.id);
    if (!folder || folder.userId !== userId) {
      throw new Error("Not authorized");
    }

    // Unfile all documents in this folder
    const allPerms = await ctx.db
      .query("permissions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const perm of allPerms) {
      const doc = await ctx.db.get(perm.documentId);
      if (doc && doc.folderId === args.id) {
        await ctx.db.patch(doc._id, { folderId: undefined });
      }
    }

    await ctx.db.delete(args.id);
  },
});
