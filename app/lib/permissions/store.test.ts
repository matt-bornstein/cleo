import {
  getRoleForUser,
  hasDocumentAccess,
  listPermissions,
  removePermission,
  resetPermissionsForTests,
  upsertPermission,
} from "@/lib/permissions/store";

describe("permissions store", () => {
  beforeEach(() => {
    resetPermissionsForTests();
    window.localStorage.clear();
  });

  it("adds and updates a collaborator role by email", () => {
    const created = upsertPermission("doc-1", "user@example.com", "viewer");
    expect(created.role).toBe("viewer");

    const updated = upsertPermission("doc-1", "user@example.com", "editor");
    expect(updated.id).toBe(created.id);
    expect(updated.role).toBe("editor");
  });

  it("removes collaborator permission", () => {
    const created = upsertPermission("doc-1", "user@example.com", "commenter");
    removePermission(created.id);
    expect(listPermissions("doc-1")).toHaveLength(0);
  });

  it("returns owner role for document owner and viewer by default otherwise", () => {
    expect(getRoleForUser("doc-2", "me@local.dev", "me@local.dev")).toBe("owner");
    expect(getRoleForUser("doc-2", "other@local.dev", "me@local.dev")).toBe("viewer");
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

    upsertPermission("doc-3", "viewer@example.com", "viewer");
    expect(hasDocumentAccess("doc-3", "viewer@example.com", "owner@example.com")).toBe(
      true,
    );
  });
});
