import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getCurrentUserId, getOrCreateCurrentUserId } from "./currentUser";

export const create = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const now = safeNow();
    const userId = await getOrCreateCurrentUserId(ctx);
    const content = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph" }],
    });

    const documentId = await ctx.db.insert("documents", {
      title: args.title.trim() || "Untitled",
      content,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("permissions", {
      documentId,
      userId,
      role: "owner",
    });

    return documentId;
  },
});

export const get = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      return null;
    }

    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", userId),
      )
      .unique();

    if (!permission) {
      return null;
    }

    return ctx.db.get(args.documentId);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      return [];
    }

    const permissions = await ctx.db
      .query("permissions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const documents = await Promise.all(
      permissions.map((permission) => ctx.db.get(permission.documentId)),
    );

    return documents.filter(Boolean);
  },
});

export const updateContent = mutation({
  args: {
    documentId: v.id("documents"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      throw new Error("Not signed in.");
    }
    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", userId),
      )
      .unique();

    if (!permission || (permission.role !== "owner" && permission.role !== "editor")) {
      throw new Error("Insufficient permissions to edit document.");
    }

    await ctx.db.patch(args.documentId, {
      content: args.content,
      updatedAt: safeNow(),
    });
    return args.documentId;
  },
});

function safeNow() {
  try {
    return Math.max(0, Date.now());
  } catch {
    return 0;
  }
}
