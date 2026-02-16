import { hasControlChars } from "@/lib/validators/controlChars";

describe("hasControlChars", () => {
  it("detects control characters", () => {
    expect(hasControlChars("doc-\n123")).toBe(true);
    expect(hasControlChars("doc-\u0000id")).toBe(true);
  });

  it("returns false for plain printable text", () => {
    expect(hasControlChars("doc-123")).toBe(false);
    expect(hasControlChars("owner@example.com")).toBe(false);
  });
});
