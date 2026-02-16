import type { Role } from "@/lib/types";

const roleRank: Record<Role, number> = {
  viewer: 0,
  commenter: 1,
  editor: 2,
  owner: 3,
};

export function hasPermission(userRole: Role | undefined, minimumRole: Role) {
  if (!userRole) return false;
  return roleRank[userRole] >= roleRank[minimumRole];
}

