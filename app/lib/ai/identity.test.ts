import { DEFAULT_AI_USER_ID, normalizeAIUserId } from "@/lib/ai/identity";

describe("normalizeAIUserId", () => {
  it("returns trimmed user id when provided", () => {
    expect(normalizeAIUserId("  alice@example.com  ")).toBe("alice@example.com");
  });

  it("falls back to local default for blank values", () => {
    expect(normalizeAIUserId("   ")).toBe(DEFAULT_AI_USER_ID);
    expect(normalizeAIUserId(undefined)).toBe(DEFAULT_AI_USER_ID);
    expect(normalizeAIUserId(null)).toBe(DEFAULT_AI_USER_ID);
    expect(normalizeAIUserId(123)).toBe(DEFAULT_AI_USER_ID);
  });

  it("falls back to local default for oversized identities", () => {
    expect(normalizeAIUserId("u".repeat(257))).toBe(DEFAULT_AI_USER_ID);
  });

  it("falls back to local default for control-character identities", () => {
    expect(normalizeAIUserId("alice\nadmin")).toBe(DEFAULT_AI_USER_ID);
  });
});

