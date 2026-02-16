import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

async function getOrCreateCurrentUser(ctx: {
  auth: { getUserIdentity: () => Promise<{ email?: string; name?: string } | null> };
  db: {
    query: (...args: unknown[]) => {
      withIndex: (...idxArgs: unknown[]) => {
        unique: () => Promise<unknown>;
      };
    };
    insert: (...args: unknown[]) => Promise<unknown>;
  };
}) {
  const identity = await ctx.auth.getUserIdentity();
  const email = identity?.email ?? "dev-user@example.com";
  const name = identity?.name ?? "Local Dev User";

  const existingUser = (await ctx.db
    .query("users")
    .withIndex("by_email", (q: { eq: (field: string, value: string) => unknown }) =>
      q.eq("email", email),
    )
    .unique()) as { _id: string } | null;

  if (existingUser) {
    return existingUser._id;
  }

  return (await ctx.db.insert("users", { name, email })) as string;
}

export const create = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Math.max(0, Date.now());
    const userId = await getOrCreateCurrentUser(ctx);
    const content = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph" }],
    });

    const documentId = (await ctx.db.insert("documents", {
      title: args.title.trim() || "Untitled",
      content,
      createdAt: now,
      updatedAt: now,
    })) as string;

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
    const userId = await getOrCreateCurrentUser(ctx);

    const permission = (await ctx.db
      .query("permissions")
      .withIndex(
        "by_document_user",
        (q: { eq: (field: string, value: unknown) => { eq: (field2: string, value2: unknown) => unknown } }) =>
          q.eq("documentId", args.documentId).eq("userId", userId),
      )
      .unique()) as { role: string } | null;

    if (!permission) {
      return null;
    }

    return ctx.db.get(args.documentId);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOrCreateCurrentUser(ctx);

    const permissions = (await ctx.db
      .query("permissions")
      .withIndex("by_user", (q: { eq: (field: string, value: unknown) => unknown }) =>
        q.eq("userId", userId),
      )
      .collect()) as Array<{ documentId: string }>;

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
    const userId = await getOrCreateCurrentUser(ctx);
    const permission = (await ctx.db
      .query("permissions")
      .withIndex(
        "by_document_user",
        (q: { eq: (field: string, value: unknown) => { eq: (field2: string, value2: unknown) => unknown } }) =>
          q.eq("documentId", args.documentId).eq("userId", userId),
      )
      .unique()) as { role: "owner" | "editor" | "commenter" | "viewer" } | null;

    if (!permission || (permission.role !== "owner" && permission.role !== "editor")) {
      throw new Error("Insufficient permissions to edit document.");
    }

    await ctx.db.patch(args.documentId, {
      content: args.content,
      updatedAt: Math.max(0, Date.now()),
    });
    return args.documentId;
  },
});
