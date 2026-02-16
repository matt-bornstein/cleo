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
});

