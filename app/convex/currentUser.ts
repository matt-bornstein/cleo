import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const LOCAL_DEV_EMAIL = "dev-user@example.com";
const LOCAL_DEV_NAME = "Local Dev User";

function getPreferredIdentity(identity: { email?: string; name?: string } | null) {
  return {
    email: identity?.email ?? LOCAL_DEV_EMAIL,
    name: identity?.name ?? LOCAL_DEV_NAME,
  };
}

export async function getCurrentUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  const { email } = getPreferredIdentity(identity);

  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

  return existingUser?._id ?? null;
}

export async function getOrCreateCurrentUserId(ctx: MutationCtx): Promise<Id<"users">> {
  const existingUserId = await getCurrentUserId(ctx);
  if (existingUserId) {
    return existingUserId;
  }

  const identity = await ctx.auth.getUserIdentity();
  const { email, name } = getPreferredIdentity(identity);
  return ctx.db.insert("users", { email, name });
}
