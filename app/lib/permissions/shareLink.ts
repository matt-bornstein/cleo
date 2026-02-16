import type { Role } from "@/lib/types";
import { hasControlChars } from "@/lib/validators/controlChars";

const allowedShareRoles: Role[] = ["editor", "commenter", "viewer"];

export function sanitizeShareRole(rawRole: unknown) {
  if (typeof rawRole !== "string") return undefined;
  const normalizedRole = rawRole.trim().toLowerCase();
  if (!normalizedRole || hasControlChars(normalizedRole)) return undefined;
  return allowedShareRoles.includes(normalizedRole as Role)
    ? (normalizedRole as Role)
    : undefined;
}
