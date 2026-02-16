import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

export const upsertCurrentUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUsers = (await ctx.db
      .query("users")
      .withIndex("by_email", (q: { eq: (field: string, value: string) => unknown }) =>
        q.eq("email", args.email),
      )
      .collect()) as Array<{ _id: string }>;

    if (existingUsers.length > 0) {
      const existing = existingUsers[0];
      await ctx.db.patch(existing._id, {
        name: args.name,
        avatarUrl: args.avatarUrl,
      });
      return existing._id;
    }

    return ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      avatarUrl: args.avatarUrl,
    });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) {
      return null;
    }

    const users = (await ctx.db
      .query("users")
      .withIndex("by_email", (q: { eq: (field: string, value: string) => unknown }) =>
        q.eq("email", identity.email!),
      )
      .collect()) as Array<{ _id: string }>;

    return users[0] ?? null;
  },
});
