import { sanitizeShareRole } from "@/lib/permissions/shareLink";

describe("sanitizeShareRole", () => {
  it("accepts valid share roles", () => {
    expect(sanitizeShareRole("viewer")).toBe("viewer");
    expect(sanitizeShareRole("commenter")).toBe("commenter");
    expect(sanitizeShareRole("editor")).toBe("editor");
    expect(sanitizeShareRole(" Viewer ")).toBe("viewer");
    expect(sanitizeShareRole("EDITOR")).toBe("editor");
  });

  it("rejects invalid or owner role values", () => {
    expect(sanitizeShareRole("owner")).toBeUndefined();
    expect(sanitizeShareRole("admin")).toBeUndefined();
    expect(sanitizeShareRole("   ")).toBeUndefined();
    expect(sanitizeShareRole(null)).toBeUndefined();
  });
});
