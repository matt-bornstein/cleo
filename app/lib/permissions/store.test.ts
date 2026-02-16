import {
  getRoleForUser,
  hasDocumentAccess,
  listPermissions,
  removePermission,
  resetPermissionsForTests,
  upsertPermission,
} from "@/lib/permissions/store";
import { vi } from "vitest";

function safeClearLocalStorage() {
  try {
    window.localStorage.clear();
  } catch {
    return;
  }
}

describe("permissions store", () => {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "localStorage",
  );

  beforeEach(() => {
    vi.restoreAllMocks();
    if (localStorageDescriptor) {
      Object.defineProperty(window, "localStorage", localStorageDescriptor);
    }
    resetPermissionsForTests();
    safeClearLocalStorage();
  });

  it("adds and updates a collaborator role by email", () => {
    const created = upsertPermission("doc-1", "user@example.com", "viewer");
    expect(created).not.toBeNull();
    expect(created?.role).toBe("viewer");

    const updated = upsertPermission("doc-1", "user@example.com", "editor");
    expect(updated).not.toBeNull();
    expect(updated!.id).toBe(created!.id);
    expect(updated!.role).toBe("editor");
  });

  it("avoids persisting when collaborator role update is unchanged", () => {
    upsertPermission("doc-1", "user@example.com", "viewer");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const baselineCalls = setItemSpy.mock.calls.length;

    const unchanged = upsertPermission("doc-1", "user@example.com", "viewer");

    expect(unchanged).toEqual(
      expect.objectContaining({
        email: "user@example.com",
        role: "viewer",
      }),
    );
    expect(setItemSpy.mock.calls.length).toBe(baselineCalls);
  });

  it("lists collaborators sorted by normalized email", () => {
    upsertPermission("doc-order", "zeta@example.com", "viewer");
    upsertPermission("doc-order", "alpha@example.com", "viewer");

    expect(listPermissions("doc-order").map((entry) => entry.email)).toEqual([
      "alpha@example.com",
      "zeta@example.com",
    ]);
  });

  it("removes collaborator permission", () => {
    const created = upsertPermission("doc-1", "user@example.com", "commenter");
    expect(created).not.toBeNull();
    const removed = removePermission(`  ${created!.id}  `);
    expect(removed).toBe(true);
    expect(listPermissions("doc-1")).toHaveLength(0);
  });

  it("returns false when removing unknown permission id", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const baselineCalls = setItemSpy.mock.calls.length;

    expect(removePermission("missing-id")).toBe(false);
    expect(removePermission("   ")).toBe(false);
    expect(removePermission("bad\nid")).toBe(false);
    expect(setItemSpy.mock.calls.length).toBe(baselineCalls);
  });

  it("returns owner role for document owner and viewer by default otherwise", () => {
    expect(getRoleForUser("doc-2", "me@local.dev", "me@local.dev")).toBe("owner");
    expect(getRoleForUser("doc-2", "other@local.dev", "me@local.dev")).toBe("viewer");
    expect(getRoleForUser("doc-2", "other@local.dev", "owner\n@local.dev")).toBe(
      "viewer",
    );
    upsertPermission("doc-2", "other@local.dev", "commenter");
    expect(getRoleForUser("doc-2", "other@local.dev", "me@local.dev")).toBe(
      "commenter",
    );
  });

  it("checks document access using owner or explicit permission", () => {
    expect(hasDocumentAccess("doc-3", "owner@example.com", "owner@example.com")).toBe(
      true,
    );
    expect(hasDocumentAccess("doc-3", "viewer@example.com", "owner@example.com")).toBe(
      false,
    );
    expect(
      hasDocumentAccess("doc-3", "owner@example.com", "owner@\nexample.com"),
    ).toBe(false);

    upsertPermission("doc-3", "viewer@example.com", "viewer");
    expect(hasDocumentAccess("doc-3", "viewer@example.com", "owner@example.com")).toBe(
      true,
    );
  });

  it("normalizes legacy whitespace collaborator emails during updates", () => {
    window.localStorage.setItem(
      "plan00.permissions.v1",
      JSON.stringify({
        permissions: [
          {
            id: "legacy-perm",
            documentId: "doc-legacy",
            email: " Legacy@Example.com ",
            role: "viewer",
          },
        ],
      }),
    );

    const updated = upsertPermission("doc-legacy", "legacy@example.com", "editor");
    expect(updated).not.toBeNull();
    expect(updated!.id).toBe("legacy-perm");
    expect(updated!.email).toBe("legacy@example.com");
    expect(updated!.role).toBe("editor");
    expect(listPermissions("doc-legacy")).toHaveLength(1);
  });

  it("filters malformed persisted permission entries on load", () => {
    window.localStorage.setItem(
      "plan00.permissions.v1",
      JSON.stringify({
        permissions: [
          {
            id: "valid-id",
            documentId: "  doc-valid  ",
            email: " USER@EXAMPLE.COM ",
            role: "viewer",
          },
          {
            id: "",
            documentId: "doc-invalid",
            email: "user@example.com",
            role: "viewer",
          },
          {
            id: 123,
            documentId: "doc-valid",
            email: "user@example.com",
            role: "viewer",
          },
          {
            id: "bad\nid",
            documentId: "doc-invalid",
            email: "user@example.com",
            role: "viewer",
          },
          {
            id: "bad-doc",
            documentId: "doc-\ninvalid",
            email: "user@example.com",
            role: "editor",
          },
          {
            id: "bad-email",
            documentId: "doc-valid",
            email: "bad\nemail@example.com",
            role: "editor",
          },
          {
            id: "bad-format-email",
            documentId: "doc-valid",
            email: "not-an-email",
            role: "editor",
          },
          {
            id: "bad-role",
            documentId: "doc-valid",
            email: "user@example.com",
            role: "admin",
          },
          null,
          {
            id: " duplicate ",
            documentId: "doc-valid",
            email: "user@example.com",
            role: "editor",
          },
        ],
      }),
    );

    expect(listPermissions("doc-valid")).toEqual([
      {
        id: "valid-id",
        documentId: "doc-valid",
        email: "user@example.com",
        role: "viewer",
      },
    ]);
  });

  it("skips persisted permissions when field getters throw during load", () => {
    const permissionWithThrowingGetters = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(permissionWithThrowingGetters, "id", {
      get() {
        throw new Error("id getter failed");
      },
    });
    Object.defineProperty(permissionWithThrowingGetters, "documentId", {
      get() {
        throw new Error("documentId getter failed");
      },
    });
    Object.defineProperty(permissionWithThrowingGetters, "email", {
      get() {
        throw new Error("email getter failed");
      },
    });
    Object.defineProperty(permissionWithThrowingGetters, "role", {
      get() {
        throw new Error("role getter failed");
      },
    });

    window.localStorage.setItem("plan00.permissions.v1", "{}");
    vi.spyOn(JSON, "parse").mockReturnValue({
      permissions: [permissionWithThrowingGetters],
    });

    expect(listPermissions("doc-valid")).toEqual([]);
  });

  it("returns empty when persisted permissions container is non-array", () => {
    window.localStorage.setItem(
      "plan00.permissions.v1",
      JSON.stringify({ permissions: { id: "not-array" } }),
    );

    expect(listPermissions("doc-valid")).toEqual([]);
  });

  it("uses stable id tie-breaker for duplicate persisted roles", () => {
    window.localStorage.setItem(
      "plan00.permissions.v1",
      JSON.stringify({
        permissions: [
          {
            id: "perm-z",
            documentId: "doc-tie",
            email: "user@example.com",
            role: "viewer",
          },
          {
            id: "perm-a",
            documentId: "doc-tie",
            email: "user@example.com",
            role: "viewer",
          },
        ],
      }),
    );

    expect(listPermissions("doc-tie")).toEqual([
      {
        id: "perm-a",
        documentId: "doc-tie",
        email: "user@example.com",
        role: "viewer",
      },
    ]);
  });

  it("rejects invalid document ids and malformed user emails", () => {
    expect(upsertPermission("   ", "user@example.com", "viewer")).toBeNull();
    expect(upsertPermission("doc-1", "user@example.com", "admin" as never)).toBeNull();
    expect(upsertPermission("doc-1", "not-an-email", "viewer")).toBeNull();
    expect(upsertPermission("doc-1", "bad\nemail@example.com", "viewer")).toBeNull();
    expect(listPermissions("doc-\ninvalid")).toEqual([]);
    expect(getRoleForUser("doc-\ninvalid", "user@example.com")).toBe("viewer");
    expect(getRoleForUser("doc-1", "not-an-email")).toBe("viewer");
    expect(hasDocumentAccess("doc-\ninvalid", "user@example.com")).toBe(false);
    expect(hasDocumentAccess("doc-1", "not-an-email")).toBe(false);
  });

  it("falls back to in-memory permissions when localStorage getter throws", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("localStorage getter failed");
      },
    });

    const created = upsertPermission("doc-1", "user@example.com", "viewer");
    expect(created).not.toBeNull();
    expect(listPermissions("doc-1")).toEqual([
      expect.objectContaining({
        email: "user@example.com",
        role: "viewer",
      }),
    ]);
  });

  it("returns empty list when localStorage getItem throws", () => {
    upsertPermission("doc-1", "user@example.com", "viewer");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("getItem failed");
    });

    expect(listPermissions("doc-1")).toEqual([]);
  });

  it("returns normalized permission writes when localStorage setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("setItem failed");
    });

    const created = upsertPermission("doc-1", " user@example.com ", "viewer");
    expect(created).toEqual(
      expect.objectContaining({
        email: "user@example.com",
        role: "viewer",
      }),
    );
  });

  it("handles malformed non-string runtime inputs safely", () => {
    expect(upsertPermission(123 as unknown as string, "user@example.com", "viewer")).toBe(
      null,
    );
    expect(
      upsertPermission("doc-1", "user@example.com", 123 as unknown as "viewer"),
    ).toBeNull();
    expect(listPermissions(123 as unknown as string)).toEqual([]);
    expect(getRoleForUser("doc-1", 123 as unknown as string)).toBe("viewer");
    expect(hasDocumentAccess("doc-1", 123 as unknown as string)).toBe(false);
    expect(removePermission(123 as unknown as string)).toBe(false);
  });
});
