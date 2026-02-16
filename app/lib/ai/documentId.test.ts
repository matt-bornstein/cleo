import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";

describe("ai document id helpers", () => {
  it("normalizes by trimming surrounding whitespace", () => {
    expect(normalizeDocumentId("  doc-123  ")).toBe("doc-123");
  });

  it("accepts valid ids and rejects invalid values", () => {
    expect(isValidDocumentId("doc-123")).toBe(true);
    expect(isValidDocumentId("  doc-123  ")).toBe(true);
    expect(isValidDocumentId("   ")).toBe(false);
    expect(isValidDocumentId("d".repeat(257))).toBe(false);
    expect(isValidDocumentId("doc-\n123")).toBe(false);
  });
});
