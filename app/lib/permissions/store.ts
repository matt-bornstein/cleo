import { MAX_USER_ID_LENGTH } from "@/lib/ai/constraints";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import type { Role } from "@/lib/types";
import { normalizeEmailOrUndefined } from "@/lib/user/email";
import { generateLocalId } from "@/lib/utils/id";
import { hasControlChars } from "@/lib/validators/controlChars";
import { isValidEmail } from "@/lib/validators/email";

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

function getStorage() {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function loadState(): PermissionState {
  const storage = getStorage();
  if (!storage) return inMemoryState;
  const raw = safeGetItem(storage, STORAGE_KEY);
  if (!raw) return { permissions: [] };
  try {
    const parsed = JSON.parse(raw) as { permissions?: unknown };
    if (!Array.isArray(parsed.permissions)) {
      return { permissions: [] };
    }

    const sanitizedPermissions = parsed.permissions.flatMap((entry) => {
        if (!entry || typeof entry !== "object") {
          return [];
        }

        const candidate = entry as Partial<PermissionEntry>;
        const documentId = safeReadPersistedPermissionField(candidate, "documentId");
        const email = safeReadPersistedPermissionField(candidate, "email");
        const id = safeReadPersistedPermissionField(candidate, "id");
        const role = safeReadPersistedPermissionField(candidate, "role");
        const normalizedDocumentId = normalizeDocumentId(documentId);
        const normalizedEmail = normalizeEmailOrUndefined(email);
        const normalizedPermissionId = normalizePermissionId(id);
        const normalizedRole = normalizePermissionRole(role);
        if (
          !isValidDocumentId(normalizedDocumentId) ||
          !normalizedEmail ||
          !isValidEmail(normalizedEmail) ||
          !normalizedRole ||
          !normalizedPermissionId
        ) {
          return [];
        }

        return [
          {
            id: normalizedPermissionId,
            documentId: normalizedDocumentId,
            email: normalizedEmail,
            role: normalizedRole,
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
  inMemoryState.permissions = [...state.permissions];
  const storage = getStorage();
  if (!storage) {
    return;
  }
  safeSetItem(storage, STORAGE_KEY, JSON.stringify(state));
}

export function listPermissions(documentId: unknown) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) return [];

  return loadState()
    .permissions.filter((entry) => entry.documentId === normalizedDocumentId)
    .sort((a, b) => a.email.localeCompare(b.email));
}

export function getRoleForUser(
  documentId: unknown,
  email: unknown,
  ownerEmail?: unknown,
): Role {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) {
    return "viewer";
  }

  const normalizedEmail = normalizeEmailOrUndefined(email);
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
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
  documentId: unknown,
  email: unknown,
  ownerEmail?: unknown,
) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) {
    return false;
  }

  const normalizedEmail = normalizeEmailOrUndefined(email);
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
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

export function upsertPermission(
  documentId: unknown,
  email: unknown,
  role: unknown,
) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) {
    return null;
  }

  const normalizedEmail = normalizeEmailOrUndefined(email);
  const normalizedRole = normalizePermissionRole(role);
  if (
    !normalizedEmail ||
    !isValidEmail(normalizedEmail) ||
    !normalizedRole ||
    !ALLOWED_ROLES.has(normalizedRole)
  ) {
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
      id: generateLocalId(),
      documentId: normalizedDocumentId,
      email: normalizedEmail,
      role: normalizedRole,
    };
    state.permissions.push(permission);
    persistState(state);
    return permission;
  }
  const existing = state.permissions[index];
  if (existing.email === normalizedEmail && existing.role === normalizedRole) {
    return existing;
  }

  state.permissions[index] = {
    ...existing,
    email: normalizedEmail,
    role: normalizedRole,
  };
  persistState(state);
  return state.permissions[index];
}

export function removePermission(permissionId: unknown) {
  const normalizedPermissionId = normalizePermissionId(permissionId);
  if (!normalizedPermissionId) {
    return false;
  }

  const state = loadState();
  const beforeCount = state.permissions.length;
  state.permissions = state.permissions.filter(
    (entry) => entry.id !== normalizedPermissionId,
  );
  if (state.permissions.length === beforeCount) {
    return false;
  }

  persistState(state);
  return true;
}

export function resetPermissionsForTests() {
  inMemoryState.permissions = [];
  persistState({ permissions: [] });
}

function normalizePermissionId(value: unknown) {
  const normalizedValue = typeof value === "string" ? value.trim() : undefined;
  if (
    !normalizedValue ||
    normalizedValue.length > MAX_USER_ID_LENGTH ||
    hasControlChars(normalizedValue)
  ) {
    return undefined;
  }

  return normalizedValue;
}

function normalizePermissionRole(value: unknown): Role | undefined {
  return value === "owner" ||
    value === "editor" ||
    value === "commenter" ||
    value === "viewer"
    ? value
    : undefined;
}

function safeGetItem(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    return;
  }
}

function safeReadPersistedPermissionField(
  permission: Partial<PermissionEntry>,
  key: "id" | "documentId" | "email" | "role",
) {
  try {
    return permission[key];
  } catch {
    return undefined;
  }
}
