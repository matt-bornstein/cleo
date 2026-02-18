import { diff_match_patch } from "diff-match-patch";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getOrCreateCurrentUserId } from "./currentUser";

const dmp = new diff_match_patch();

function patchFromSnapshots(beforeSnapshot: string, afterSnapshot: string) {
  const patches = dmp.patch_make(beforeSnapshot, afterSnapshot);
  return dmp.patch_toText(patches);
}

export const triggerIdleSave = mutation({
  args: {
    documentId: v.id("documents"),
    snapshot: v.string(),
  },
  handler: async (ctx, args) => {
    const now = safeNow();
    const userId = await getOrCreateCurrentUserId(ctx);
    const document = await ctx.db.get(args.documentId);

    if (!document) {
      throw new Error("Document not found.");
    }

    if (document.lastDiffAt && now - document.lastDiffAt < 4000) {
      return { skipped: true, reason: "dedup_window" };
    }

    const latestDiff = (await ctx.db
      .query("diffs")
      .withIndex("by_document_time", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .first()) as { snapshotAfter: string } | null;

    const beforeSnapshot = latestDiff?.snapshotAfter ?? document.content;
    if (beforeSnapshot === args.snapshot) {
      await ctx.db.patch(args.documentId, { lastDiffAt: now });
      return { skipped: true, reason: "no_change" };
    }

    const patch = patchFromSnapshots(beforeSnapshot, args.snapshot);
    await ctx.db.insert("diffs", {
      documentId: args.documentId,
      userId,
      patch,
      snapshotAfter: args.snapshot,
      source: "manual",
      createdAt: now,
    });

    await ctx.db.patch(args.documentId, {
      content: args.snapshot,
      lastDiffAt: now,
      updatedAt: now,
    });

    return { skipped: false };
  },
});

export const listByDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("diffs")
      .withIndex("by_document_time", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .collect();
  },
});

function safeNow() {
  try {
    return Math.max(0, Date.now());
  } catch {
    return 0;
  }
}
