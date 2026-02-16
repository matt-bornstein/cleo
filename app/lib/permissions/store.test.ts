import {
  getRoleForUser,
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

  it("returns owner role by default and explicit shared role when present", () => {
    expect(getRoleForUser("doc-2", "me@local.dev")).toBe("owner");
    upsertPermission("doc-2", "me@local.dev", "viewer");
    expect(getRoleForUser("doc-2", "me@local.dev")).toBe("viewer");
  });
});
