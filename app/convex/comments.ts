import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getOrCreateCurrentUserId } from "./currentUser";

export const create = mutation({
  args: {
    documentId: v.id("documents"),
    content: v.string(),
    anchorFrom: v.number(),
    anchorTo: v.number(),
    anchorText: v.string(),
  },
  handler: async (ctx, args) => {
    const now = safeNow();
    const userId = await getOrCreateCurrentUserId(ctx);
    return ctx.db.insert("comments", {
      ...args,
      userId,
      resolved: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const list = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("comments")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
  },
});

export const resolve = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.commentId, {
      resolved: true,
      updatedAt: safeNow(),
    });
    return args.commentId;
  },
});

export const reply = mutation({
  args: {
    parentCommentId: v.id("comments"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = safeNow();
    const userId = await getOrCreateCurrentUserId(ctx);
    const parent = await ctx.db.get(args.parentCommentId);
    if (!parent) throw new Error("Parent comment not found");

    return ctx.db.insert("comments", {
      documentId: parent.documentId,
      userId,
      content: args.content,
      anchorFrom: parent.anchorFrom,
      anchorTo: parent.anchorTo,
      anchorText: parent.anchorText,
      parentCommentId: args.parentCommentId,
      resolved: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.commentId);
    return args.commentId;
  },
});

function safeNow() {
  try {
    return Math.max(0, Date.now());
  } catch {
    return 0;
  }
}
