import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getMyRole = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", userId)
      )
      .first();

    return permission?.role ?? null;
  },
});

export const getPermissions = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Check that requesting user has access
    const myPerm = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", userId)
      )
      .first();

    if (!myPerm) return [];

    const perms = await ctx.db
      .query("permissions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const result = await Promise.all(
      perms.map(async (perm) => {
        const user = await ctx.db.get(perm.userId);
        return {
          _id: perm._id,
          userId: perm.userId,
          role: perm.role,
          userName: user?.name ?? user?.email ?? "Unknown",
          userEmail: user?.email ?? "",
        };
      })
    );

    return result;
  },
});

export const share = mutation({
  args: {
    documentId: v.id("documents"),
    email: v.string(),
    role: v.union(
      v.literal("editor"),
      v.literal("commenter"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check that current user is the owner
    const myPerm = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", userId)
      )
      .first();

    if (!myPerm || myPerm.role !== "owner") {
      throw new Error("Only the owner can share");
    }

    // Find the target user by email
    const targetUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (!targetUser) {
      throw new Error("User not found. They must sign in first.");
    }

    // Check if already has permission
    const existing = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", targetUser._id)
      )
      .first();

    if (existing) {
      if (existing.role === "owner") {
        throw new Error("Cannot change owner role");
      }
      await ctx.db.patch(existing._id, { role: args.role });
    } else {
      await ctx.db.insert("permissions", {
        documentId: args.documentId,
        userId: targetUser._id,
        role: args.role,
      });
    }
  },
});

export const unshare = mutation({
  args: {
    documentId: v.id("documents"),
    permissionId: v.id("permissions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check that current user is the owner
    const myPerm = await ctx.db
      .query("permissions")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", userId)
      )
      .first();

    if (!myPerm || myPerm.role !== "owner") {
      throw new Error("Only the owner can manage sharing");
    }

    const perm = await ctx.db.get(args.permissionId);
    if (!perm) throw new Error("Permission not found");
    if (perm.role === "owner") throw new Error("Cannot remove owner");

    await ctx.db.delete(args.permissionId);
  },
});
