import type { Role } from "@/lib/types";

const allowedShareRoles: Role[] = ["editor", "commenter", "viewer"];

export function sanitizeShareRole(rawRole: string | null | undefined) {
  if (!rawRole) return undefined;
  const normalizedRole = rawRole.trim().toLowerCase();
  if (!normalizedRole) return undefined;
  return allowedShareRoles.includes(normalizedRole as Role)
    ? (normalizedRole as Role)
    : undefined;
}
