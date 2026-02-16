import {
  normalizeEmailOrFallback,
  normalizeEmailOrUndefined,
} from "@/lib/user/email";

describe("user email normalization helpers", () => {
  it("normalizes valid emails to lowercase trimmed values", () => {
    expect(normalizeEmailOrUndefined("  User@Example.com  ")).toBe("user@example.com");
  });

  it("returns undefined for malformed or unsafe values", () => {
    expect(normalizeEmailOrUndefined(undefined)).toBeUndefined();
    expect(normalizeEmailOrUndefined("   ")).toBeUndefined();
    expect(normalizeEmailOrUndefined("user\n@example.com")).toBeUndefined();
    expect(normalizeEmailOrUndefined("u".repeat(257))).toBeUndefined();
  });

  it("falls back when value cannot be normalized", () => {
    expect(normalizeEmailOrFallback("   ", "fallback@example.com")).toBe(
      "fallback@example.com",
    );
    expect(normalizeEmailOrFallback("ok@example.com", "fallback@example.com")).toBe(
      "ok@example.com",
    );
  });
});
