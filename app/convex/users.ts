import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getCurrentUserId } from "./currentUser";

export const upsertCurrentUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUsers = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .collect();

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
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      return null;
    }

    const existingUser = await ctx.db.get(userId);
    if (existingUser) {
      return existingUser;
    }

    return null;
  },
});
