import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    documentId: v.id("documents"),
    content: v.string(),
    anchorFrom: v.number(),
    anchorTo: v.number(),
    anchorText: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check permission (commenter or higher)
    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", userId)
      )
      .first();

    if (!permission || permission.role === "viewer") {
      throw new Error("Not authorized to comment");
    }

    const now = Date.now();
    return await ctx.db.insert("comments", {
      documentId: args.documentId,
      userId,
      content: args.content,
      anchorFrom: args.anchorFrom,
      anchorTo: args.anchorTo,
      anchorText: args.anchorText,
      resolved: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const list = query({
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

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Enrich with user info
    const enriched = await Promise.all(
      comments.map(async (comment) => {
        const user = await ctx.db.get(comment.userId);
        return {
          ...comment,
          userName: user?.name ?? user?.email ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});

export const reply = mutation({
  args: {
    documentId: v.id("documents"),
    parentCommentId: v.id("comments"),
    content: v.string(),
  },
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

    if (!permission || permission.role === "viewer") {
      throw new Error("Not authorized to comment");
    }

    const parent = await ctx.db.get(args.parentCommentId);
    if (!parent) throw new Error("Parent comment not found");

    const now = Date.now();
    return await ctx.db.insert("comments", {
      documentId: args.documentId,
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

export const resolve = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    // Check permission (owner, editor, or comment author)
    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", comment.documentId).eq("userId", userId)
      )
      .first();

    if (!permission) throw new Error("Not authorized");
    if (
      permission.role === "viewer" &&
      comment.userId !== userId
    ) {
      throw new Error("Not authorized to resolve this comment");
    }

    await ctx.db.patch(args.commentId, {
      resolved: true,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    // Check permission (author or document owner)
    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", comment.documentId).eq("userId", userId)
      )
      .first();

    if (!permission) throw new Error("Not authorized");
    if (comment.userId !== userId && permission.role !== "owner") {
      throw new Error("Not authorized to delete this comment");
    }

    // Also delete replies
    const replies = await ctx.db
      .query("comments")
      .withIndex("by_parent", (q) => q.eq("parentCommentId", args.commentId))
      .collect();

    for (const reply of replies) {
      await ctx.db.delete(reply._id);
    }

    await ctx.db.delete(args.commentId);
  },
});
