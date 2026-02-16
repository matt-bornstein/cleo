import type { Role } from "@/lib/types";

const allowedShareRoles: Role[] = ["editor", "commenter", "viewer"];

export function sanitizeShareRole(rawRole: string | null | undefined) {
  if (!rawRole) return undefined;
  return allowedShareRoles.includes(rawRole as Role)
    ? (rawRole as Role)
    : undefined;
}
