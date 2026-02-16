import type { Role } from "@/lib/types";

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
  if (value === "viewer") return "viewer";
  if (value === "commenter") return "commenter";
  if (value === "editor") return "editor";
  if (value === "owner") return "owner";
  return undefined;
}
