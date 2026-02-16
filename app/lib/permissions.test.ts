import { hasPermission } from "@/lib/permissions";

describe("hasPermission", () => {
  it("returns true when user role is equal or higher than required", () => {
    expect(hasPermission("owner", "viewer")).toBe(true);
    expect(hasPermission("editor", "commenter")).toBe(true);
    expect(hasPermission("viewer", "viewer")).toBe(true);
  });

  it("returns false when user role is lower than required or missing", () => {
    expect(hasPermission("viewer", "editor")).toBe(false);
    expect(hasPermission(undefined, "viewer")).toBe(false);
  });
});
