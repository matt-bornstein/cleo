import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // --- Documents ---
  documents: defineTable({
    title: v.string(),
    content: v.string(), // ProseMirror JSON (stringified) — cached snapshot
    lastDiffAt: v.optional(v.number()),
    chatClearedAt: v.optional(v.number()),
    aiLockedBy: v.optional(v.id("users")),
    aiLockedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_updatedAt", ["updatedAt"]),

  // --- Presence ---
  presence: defineTable({
    documentId: v.id("documents"),
    visitorId: v.string(),
    userId: v.id("users"),
    data: v.any(),
    updatedAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_visitor", ["visitorId"]),

  // --- Document Permissions ---
  permissions: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("editor"),
      v.literal("commenter"),
      v.literal("viewer")
    ),
  })
    .index("by_document", ["documentId"])
    .index("by_user", ["userId"])
    .index("by_document_user", ["documentId", "userId"]),

  // --- Diffs / Version History ---
  diffs: defineTable({
    documentId: v.id("documents"),
    userId: v.optional(v.id("users")),
    patch: v.string(),
    snapshotAfter: v.string(), // ProseMirror JSON snapshot
    source: v.union(
      v.literal("ai"),
      v.literal("manual"),
      v.literal("created")
    ),
    aiPrompt: v.optional(v.string()),
    aiModel: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_document_time", ["documentId", "createdAt"]),

  // --- Comments ---
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

  // --- User Settings ---
  userSettings: defineTable({
    userId: v.id("users"),
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),
    defaultModel: v.optional(v.string()),
    editorFontSize: v.optional(v.number()),
    editorLineSpacing: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // --- AI Chat Messages ---
  aiMessages: defineTable({
    documentId: v.id("documents"),
    userId: v.optional(v.id("users")),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.string(),
    model: v.optional(v.string()),
    diffId: v.optional(v.id("diffs")),
    createdAt: v.number(),
  }).index("by_document", ["documentId"]),
});
