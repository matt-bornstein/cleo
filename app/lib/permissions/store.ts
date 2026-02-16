import type { Role } from "@/lib/types";

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
  return loadState().permissions.filter((entry) => entry.documentId === documentId);
}

export function upsertPermission(documentId: string, email: string, role: Role) {
  const state = loadState();
  const normalizedEmail = email.trim().toLowerCase();
  const index = state.permissions.findIndex(
    (entry) =>
      entry.documentId === documentId && entry.email.toLowerCase() === normalizedEmail,
  );
  if (index === -1) {
    const permission: PermissionEntry = {
      id: crypto.randomUUID(),
      documentId,
      email: normalizedEmail,
      role,
    };
    state.permissions.push(permission);
    persistState(state);
    return permission;
  }
  state.permissions[index] = {
    ...state.permissions[index],
    role,
  };
  persistState(state);
  return state.permissions[index];
}

export function removePermission(permissionId: string) {
  const state = loadState();
  state.permissions = state.permissions.filter((entry) => entry.id !== permissionId);
  persistState(state);
}

export function resetPermissionsForTests() {
  persistState({ permissions: [] });
}
