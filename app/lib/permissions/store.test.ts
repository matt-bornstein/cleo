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
    expect(created).not.toBeNull();
    expect(created?.role).toBe("viewer");

    const updated = upsertPermission("doc-1", "user@example.com", "editor");
    expect(updated).not.toBeNull();
    expect(updated!.id).toBe(created!.id);
    expect(updated!.role).toBe("editor");
  });

  it("removes collaborator permission", () => {
    const created = upsertPermission("doc-1", "user@example.com", "commenter");
    expect(created).not.toBeNull();
    const removed = removePermission(`  ${created!.id}  `);
    expect(removed).toBe(true);
    expect(listPermissions("doc-1")).toHaveLength(0);
  });

  it("returns false when removing unknown permission id", () => {
    expect(removePermission("missing-id")).toBe(false);
    expect(removePermission("   ")).toBe(false);
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
            id: "bad-role",
            documentId: "doc-valid",
            email: "user@example.com",
            role: "admin",
          },
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
        id: "duplicate",
        documentId: "doc-valid",
        email: "user@example.com",
        role: "editor",
      },
    ]);
  });

  it("rejects invalid document ids and malformed user emails", () => {
    expect(upsertPermission("   ", "user@example.com", "viewer")).toBeNull();
    expect(upsertPermission("doc-1", "user@example.com", "admin" as never)).toBeNull();
    expect(upsertPermission("doc-1", "bad\nemail@example.com", "viewer")).toBeNull();
    expect(listPermissions("doc-\ninvalid")).toEqual([]);
    expect(getRoleForUser("doc-\ninvalid", "user@example.com")).toBe("viewer");
    expect(hasDocumentAccess("doc-\ninvalid", "user@example.com")).toBe(false);
  });
});
