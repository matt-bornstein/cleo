import type { Role } from "@/lib/types";
import { hasControlChars } from "@/lib/validators/controlChars";

const roleRank: Record<Role, number> = {
  viewer: 0,
  commenter: 1,
  editor: 2,
  owner: 3,
};

export function hasPermission(userRole: unknown, minimumRole: unknown) {
  const normalizedUserRole = normalizeRole(userRole);
  const normalizedMinimumRole = normalizeRole(minimumRole);
  if (!normalizedUserRole || !normalizedMinimumRole) return false;
  return roleRank[normalizedUserRole] >= roleRank[normalizedMinimumRole];
}

function normalizeRole(value: unknown): Role | undefined {
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalizedValue || hasControlChars(normalizedValue)) {
    return undefined;
  }

  if (normalizedValue === "viewer") return "viewer";
  if (normalizedValue === "commenter") return "commenter";
  if (normalizedValue === "editor") return "editor";
  if (normalizedValue === "owner") return "owner";
  return undefined;
}
