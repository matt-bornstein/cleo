import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return settings ?? {
      theme: "system" as const,
      defaultModel: "gpt-4o",
      editorFontSize: 16,
      editorLineSpacing: 1.5,
    };
  },
});

export const update = mutation({
  args: {
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),
    defaultModel: v.optional(v.string()),
    editorFontSize: v.optional(v.number()),
    editorLineSpacing: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.theme !== undefined && { theme: args.theme }),
        ...(args.defaultModel !== undefined && { defaultModel: args.defaultModel }),
        ...(args.editorFontSize !== undefined && { editorFontSize: args.editorFontSize }),
        ...(args.editorLineSpacing !== undefined && { editorLineSpacing: args.editorLineSpacing }),
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        theme: args.theme ?? "system",
        defaultModel: args.defaultModel ?? "gpt-4o",
        editorFontSize: args.editorFontSize ?? 16,
        editorLineSpacing: args.editorLineSpacing ?? 1.5,
      });
    }
  },
});
