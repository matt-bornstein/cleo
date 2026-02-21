import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  users: defineTable({
    // Keep Convex Auth default OAuth/user fields so auth:store can upsert users.
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    avatarUrl: v.optional(v.string()),
    settings: v.optional(
      v.object({
        theme: v.optional(
          v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
        ),
        defaultModel: v.optional(v.string()),
        editorFontSize: v.optional(v.number()),
        editorLineSpacing: v.optional(v.number()),
      }),
    ),
  })
    // Convex Auth expects a users.email index with this exact name.
    .index("email", ["email"]),

  documents: defineTable({
    title: v.string(),
    content: v.string(),
    lastDiffAt: v.optional(v.number()),
    chatClearedAt: v.optional(v.number()),
    aiLockedBy: v.optional(v.id("users")),
    aiLockedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_updatedAt", ["updatedAt"]),

  presence: defineTable({
    documentId: v.id("documents"),
    visitorId: v.string(),
    userId: v.id("users"),
    data: v.any(),
    updatedAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_visitor", ["visitorId"]),

  permissions: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("editor"),
      v.literal("commenter"),
      v.literal("viewer"),
    ),
  })
    .index("by_document", ["documentId"])
    .index("by_user", ["userId"])
    .index("by_document_user", ["documentId", "userId"]),

  diffs: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    patch: v.string(),
    snapshotAfter: v.string(),
    source: v.union(v.literal("ai"), v.literal("manual"), v.literal("created")),
    aiPrompt: v.optional(v.string()),
    aiModel: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_document_time", ["documentId", "createdAt"]),

  comments: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    content: v.string(),
    anchorFrom: v.number(),
    anchorTo: v.number(),
    anchorText: v.string(),
    lastRemapVersion: v.optional(v.number()),
    orphaned: v.optional(v.boolean()),
    resolved: v.boolean(),
    parentCommentId: v.optional(v.id("comments")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_parent", ["parentCommentId"]),

  aiMessages: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    model: v.optional(v.string()),
    diffId: v.optional(v.id("diffs")),
    createdAt: v.number(),
  }).index("by_document", ["documentId"]),
});
