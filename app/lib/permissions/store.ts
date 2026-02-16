import { MAX_USER_ID_LENGTH } from "@/lib/ai/constraints";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import type { Role } from "@/lib/types";
import { normalizeEmailOrUndefined } from "@/lib/user/email";
import { hasControlChars } from "@/lib/validators/controlChars";

const STORAGE_KEY = "plan00.permissions.v1";
const ALLOWED_ROLES = new Set<Role>(["owner", "editor", "commenter", "viewer"]);
const ROLE_PRIORITY: Record<Role, number> = {
  viewer: 0,
  commenter: 1,
  editor: 2,
  owner: 3,
};

export type PermissionEntry = {
  id: string;
  documentId: string;
  email: string;
  role: Role;
};

type PermissionState = {
  permissions: PermissionEntry[];
};

const inMemoryState: PermissionState = { permissions: [] };

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function loadState(): PermissionState {
  if (!canUseStorage()) return inMemoryState;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { permissions: [] };
  try {
    const parsed = JSON.parse(raw) as PermissionState;
    if (!parsed.permissions) {
      return { permissions: [] };
    }

    const sanitizedPermissions = parsed.permissions.flatMap((entry) => {
        const normalizedDocumentId = normalizeDocumentId(entry.documentId);
        const normalizedEmail = normalizeEmailOrUndefined(entry.email);
        const normalizedPermissionId = normalizePermissionId(entry.id);
        if (
          !isValidDocumentId(normalizedDocumentId) ||
          !normalizedEmail ||
          !ALLOWED_ROLES.has(entry.role) ||
          !normalizedPermissionId
        ) {
          return [];
        }

        return [
          {
            id: normalizedPermissionId,
            documentId: normalizedDocumentId,
            email: normalizedEmail,
            role: entry.role,
          },
        ];
      });

    const dedupedByDocumentAndEmail = new Map<string, PermissionState["permissions"][number]>();
    for (const permission of sanitizedPermissions) {
      const key = `${permission.documentId}::${permission.email}`;
      const existing = dedupedByDocumentAndEmail.get(key);
      if (!existing) {
        dedupedByDocumentAndEmail.set(key, permission);
        continue;
      }

      const existingPriority = ROLE_PRIORITY[existing.role];
      const nextPriority = ROLE_PRIORITY[permission.role];
      if (nextPriority < existingPriority) {
        dedupedByDocumentAndEmail.set(key, permission);
        continue;
      }

      if (nextPriority === existingPriority && permission.id.localeCompare(existing.id) < 0) {
        dedupedByDocumentAndEmail.set(key, permission);
      }
    }

    return {
      permissions: Array.from(dedupedByDocumentAndEmail.values()),
    };
  } catch {
    return { permissions: [] };
  }
}

function persistState(state: PermissionState) {
  if (!canUseStorage()) {
    inMemoryState.permissions = state.permissions;
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function listPermissions(documentId: string) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) return [];

  return loadState()
    .permissions.filter((entry) => entry.documentId === normalizedDocumentId)
    .sort((a, b) => a.email.localeCompare(b.email));
}

export function getRoleForUser(
  documentId: string,
  email: string,
  ownerEmail?: string,
): Role {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) {
    return "viewer";
  }

  const normalizedEmail = normalizeEmailOrUndefined(email);
  if (!normalizedEmail) {
    return "viewer";
  }
  const normalizedOwnerEmail = normalizeEmailOrUndefined(ownerEmail);

  if (normalizedOwnerEmail && normalizedEmail === normalizedOwnerEmail) {
    return "owner";
  }

  const match = loadState().permissions.find(
    (entry) =>
      entry.documentId === normalizedDocumentId &&
      entry.email === normalizedEmail,
  );
  return match?.role ?? "viewer";
}

export function hasDocumentAccess(
  documentId: string,
  email: string,
  ownerEmail?: string,
) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) {
    return false;
  }

  const normalizedEmail = normalizeEmailOrUndefined(email);
  if (!normalizedEmail) {
    return false;
  }
  const normalizedOwnerEmail = normalizeEmailOrUndefined(ownerEmail);
  if (normalizedOwnerEmail && normalizedOwnerEmail === normalizedEmail) {
    return true;
  }

  return loadState().permissions.some(
    (entry) =>
      entry.documentId === normalizedDocumentId &&
      entry.email === normalizedEmail,
  );
}

export function upsertPermission(documentId: string, email: string, role: Role) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) {
    return null;
  }

  const normalizedEmail = normalizeEmailOrUndefined(email);
  if (!normalizedEmail || !ALLOWED_ROLES.has(role)) {
    return null;
  }

  const state = loadState();
  const index = state.permissions.findIndex(
    (entry) =>
      entry.documentId === normalizedDocumentId &&
      entry.email === normalizedEmail,
  );
  if (index === -1) {
    const permission: PermissionEntry = {
      id: crypto.randomUUID(),
      documentId: normalizedDocumentId,
      email: normalizedEmail,
      role,
    };
    state.permissions.push(permission);
    persistState(state);
    return permission;
  }
  state.permissions[index] = {
    ...state.permissions[index],
    email: normalizedEmail,
    role,
  };
  persistState(state);
  return state.permissions[index];
}

export function removePermission(permissionId: string) {
  const normalizedPermissionId = normalizePermissionId(permissionId);
  if (!normalizedPermissionId) {
    return false;
  }

  const state = loadState();
  const beforeCount = state.permissions.length;
  state.permissions = state.permissions.filter(
    (entry) => entry.id !== normalizedPermissionId,
  );
  persistState(state);
  return state.permissions.length !== beforeCount;
}

export function resetPermissionsForTests() {
  persistState({ permissions: [] });
}

function normalizePermissionId(value: string | undefined) {
  const normalizedValue = value?.trim();
  if (
    !normalizedValue ||
    normalizedValue.length > MAX_USER_ID_LENGTH ||
    hasControlChars(normalizedValue)
  ) {
    return undefined;
  }

  return normalizedValue;
}
