import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export async function getCurrentUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users"> | null> {
  const authUserId = await getAuthUserId(ctx);
  if (authUserId) {
    console.info("[convex currentUser:getCurrentUserId] resolved with getAuthUserId", {
      userId: authUserId,
    });
    return authUserId;
  }

  const identity = await ctx.auth.getUserIdentity();
  console.info("[convex currentUser:getCurrentUserId] identity", {
    hasIdentity: identity !== null,
    subject: identity?.subject ?? null,
    issuer: identity?.issuer ?? null,
    email: identity?.email ?? null,
    tokenIdentifier: identity?.tokenIdentifier ?? null,
  });
  const email = normalizeEmail(identity?.email);
  if (!email) {
    console.info("[convex currentUser:getCurrentUserId] missing normalized email");
    return null;
  }

  const existingUser = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .unique();
  console.info("[convex currentUser:getCurrentUserId] lookup result", {
    email,
    hasExistingUser: existingUser !== null,
    userId: existingUser?._id ?? null,
  });

  return existingUser?._id ?? null;
}

export async function getOrCreateCurrentUserId(ctx: MutationCtx): Promise<Id<"users">> {
  const existingUserId = await getCurrentUserId(ctx);
  if (existingUserId) {
    console.info("[convex currentUser:getOrCreateCurrentUserId] reusing user", {
      userId: existingUserId,
    });
    return existingUserId;
  }

  const identity = await ctx.auth.getUserIdentity();
  console.info("[convex currentUser:getOrCreateCurrentUserId] no existing user; identity", {
    hasIdentity: identity !== null,
    subject: identity?.subject ?? null,
    issuer: identity?.issuer ?? null,
    email: identity?.email ?? null,
    tokenIdentifier: identity?.tokenIdentifier ?? null,
  });
  const email = normalizeEmail(identity?.email);
  if (!email) {
    console.info(
      "[convex currentUser:getOrCreateCurrentUserId] throwing auth required due to missing email",
    );
    throw new Error("Authentication required");
  }
  const name = normalizeName(identity?.name);
  console.info("[convex currentUser:getOrCreateCurrentUserId] creating user", {
    email,
    name,
  });
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
