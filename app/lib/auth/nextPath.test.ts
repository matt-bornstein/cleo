import { sanitizeNextPath } from "@/lib/auth/nextPath";

describe("sanitizeNextPath", () => {
  it("returns /editor fallback for invalid values", () => {
    const oversizedPath = `/editor/${"a".repeat(2050)}`;
    expect(sanitizeNextPath(undefined)).toBe("/editor");
    expect(sanitizeNextPath(null)).toBe("/editor");
    expect(sanitizeNextPath("editor/doc")).toBe("/editor");
    expect(sanitizeNextPath("//evil.com")).toBe("/editor");
    expect(sanitizeNextPath("/sign-in")).toBe("/editor");
    expect(sanitizeNextPath("/editorial")).toBe("/editor");
    expect(sanitizeNextPath("   ")).toBe("/editor");
    expect(sanitizeNextPath(123)).toBe("/editor");
    expect(sanitizeNextPath({ next: "/editor/doc-1" })).toBe("/editor");
    expect(sanitizeNextPath("/editor/doc-1\nx")).toBe("/editor");
    expect(sanitizeNextPath(oversizedPath)).toBe("/editor");
  });

  it("preserves valid relative app paths", () => {
    expect(sanitizeNextPath("/editor/doc-1")).toBe("/editor/doc-1");
    expect(sanitizeNextPath("/editor/doc-1?from=share")).toBe(
      "/editor/doc-1?from=share",
    );
    expect(sanitizeNextPath("   /editor/doc-2   ")).toBe("/editor/doc-2");
    expect(sanitizeNextPath("/editor#history")).toBe("/editor#history");
  });
});
