import { normalizeAIUserId } from "@/lib/ai/identity";

describe("normalizeAIUserId", () => {
  it("returns trimmed user id when provided", () => {
    expect(normalizeAIUserId("  alice@example.com  ")).toBe("alice@example.com");
  });

  it("falls back to local default for blank values", () => {
    expect(normalizeAIUserId("   ")).toBe("local-dev-user");
    expect(normalizeAIUserId(undefined)).toBe("local-dev-user");
    expect(normalizeAIUserId(null)).toBe("local-dev-user");
  });

  it("falls back to local default for oversized identities", () => {
    expect(normalizeAIUserId("u".repeat(257))).toBe("local-dev-user");
  });

  it("falls back to local default for control-character identities", () => {
    expect(normalizeAIUserId("alice\nadmin")).toBe("local-dev-user");
  });
});

