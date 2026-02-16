import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import type { Role } from "@/lib/types";
import { hasControlChars } from "@/lib/validators/controlChars";

const STORAGE_KEY = "plan00.permissions.v1";

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
    return parsed.permissions ? parsed : { permissions: [] };
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

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || hasControlChars(normalizedEmail)) {
    return "viewer";
  }
  const normalizedOwnerEmail = ownerEmail?.trim().toLowerCase();

  if (normalizedOwnerEmail && normalizedEmail === normalizedOwnerEmail) {
    return "owner";
  }

  const match = loadState().permissions.find(
    (entry) =>
      entry.documentId === normalizedDocumentId &&
      entry.email.trim().toLowerCase() === normalizedEmail,
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

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || hasControlChars(normalizedEmail)) {
    return false;
  }
  const normalizedOwnerEmail = ownerEmail?.trim().toLowerCase();
  if (normalizedOwnerEmail && normalizedOwnerEmail === normalizedEmail) {
    return true;
  }

  return loadState().permissions.some(
    (entry) =>
      entry.documentId === normalizedDocumentId &&
      entry.email.trim().toLowerCase() === normalizedEmail,
  );
}

export function upsertPermission(documentId: string, email: string, role: Role) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!isValidDocumentId(normalizedDocumentId)) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || hasControlChars(normalizedEmail)) {
    return null;
  }

  const state = loadState();
  const index = state.permissions.findIndex(
    (entry) =>
      entry.documentId === normalizedDocumentId &&
      entry.email.trim().toLowerCase() === normalizedEmail,
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
