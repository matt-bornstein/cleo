import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function getCurrentUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  const email = normalizeEmail(identity?.email);
  if (!email) {
    return null;
  }

  const existingUser = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .unique();

  return existingUser?._id ?? null;
}

export async function getOrCreateCurrentUserId(ctx: MutationCtx): Promise<Id<"users">> {
  const existingUserId = await getCurrentUserId(ctx);
  if (existingUserId) {
    return existingUserId;
  }

  const identity = await ctx.auth.getUserIdentity();
  const email = normalizeEmail(identity?.email);
  if (!email) {
    throw new Error("Authentication required");
  }
  const name = normalizeName(identity?.name);
  return ctx.db.insert("users", { email, name });
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeName(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "Unnamed User";
}
