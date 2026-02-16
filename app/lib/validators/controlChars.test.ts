import {
  hasControlChars,
  hasDisallowedTextControlChars,
} from "@/lib/validators/controlChars";

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

describe("hasDisallowedTextControlChars", () => {
  it("detects disallowed non-printable control characters", () => {
    expect(hasDisallowedTextControlChars("hello\u0000world")).toBe(true);
    expect(hasDisallowedTextControlChars("hello\u0007world")).toBe(true);
  });

  it("allows typical text whitespace like newline and tab", () => {
    expect(hasDisallowedTextControlChars("line one\nline two")).toBe(false);
    expect(hasDisallowedTextControlChars("column\tvalue")).toBe(false);
  });
});
