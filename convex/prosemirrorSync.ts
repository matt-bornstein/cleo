import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { GenericQueryCtx, GenericMutationCtx, GenericDataModel } from "convex/server";

export const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);

async function checkAccess(
  ctx: GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>,
  id: string
) {
  const userId = await getAuthUserId(ctx as any);
  if (!userId) throw new Error("Not authenticated");

  const permission = await (ctx as any).db
    .query("permissions")
    .withIndex("by_document_user", (q: any) =>
      q.eq("documentId", id as Id<"documents">).eq("userId", userId)
    )
    .first();

  if (!permission) throw new Error("Not authorized to access this document");
  return permission;
}

export const {
  getSnapshot,
  submitSnapshot,
  latestVersion,
  getSteps,
  submitSteps,
} = prosemirrorSync.syncApi<DataModel>({
  checkRead: async (ctx, id) => {
    await checkAccess(ctx as any, id);
  },
  checkWrite: async (ctx, id) => {
    const permission = await checkAccess(ctx as any, id);
    if (permission.role !== "owner" && permission.role !== "editor") {
      throw new Error("Not authorized to edit this document");
    }
  },
});
