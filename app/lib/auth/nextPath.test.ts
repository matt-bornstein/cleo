import { sanitizeNextPath } from "@/lib/auth/nextPath";

describe("sanitizeNextPath", () => {
  it("returns /editor fallback for invalid values", () => {
    expect(sanitizeNextPath(undefined)).toBe("/editor");
    expect(sanitizeNextPath(null)).toBe("/editor");
    expect(sanitizeNextPath("editor/doc")).toBe("/editor");
    expect(sanitizeNextPath("//evil.com")).toBe("/editor");
  });

  it("preserves valid relative app paths", () => {
    expect(sanitizeNextPath("/editor/doc-1")).toBe("/editor/doc-1");
    expect(sanitizeNextPath("/editor/doc-1?from=share")).toBe(
      "/editor/doc-1?from=share",
    );
  });
});
