import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import type { Role } from "@/lib/types";
import { normalizeEmailOrUndefined } from "@/lib/user/email";

const STORAGE_KEY = "plan00.permissions.v1";
const ALLOWED_ROLES = new Set<Role>(["owner", "editor", "commenter", "viewer"]);

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
        if (
          !isValidDocumentId(normalizedDocumentId) ||
          !normalizedEmail ||
          !ALLOWED_ROLES.has(entry.role) ||
          typeof entry.id !== "string" ||
          entry.id.trim().length === 0
        ) {
          return [];
        }

        return [
          {
            id: entry.id,
            documentId: normalizedDocumentId,
            email: normalizedEmail,
            role: entry.role,
          },
        ];
      });

    const dedupedByDocumentAndEmail = new Map<string, PermissionState["permissions"][number]>();
    for (const permission of sanitizedPermissions) {
      dedupedByDocumentAndEmail.set(
        `${permission.documentId}::${permission.email}`,
        permission,
      );
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

  return loadState().permissions.filter(
    (entry) => entry.documentId === normalizedDocumentId,
  );
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
  const state = loadState();
  const beforeCount = state.permissions.length;
  state.permissions = state.permissions.filter((entry) => entry.id !== permissionId);
  persistState(state);
  return state.permissions.length !== beforeCount;
}

export function resetPermissionsForTests() {
  persistState({ permissions: [] });
}
