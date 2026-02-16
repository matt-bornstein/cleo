import { isValidDocumentContentJson } from "@/lib/ai/documentContent";

describe("isValidDocumentContentJson", () => {
  it("accepts valid ProseMirror doc json strings", () => {
    const validContent = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
    });

    expect(isValidDocumentContentJson(validContent)).toBe(true);
  });

  it("rejects invalid document content payloads", () => {
    const oversizedContent = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "a".repeat(200_001) }] }],
    });

    expect(isValidDocumentContentJson("")).toBe(false);
    expect(isValidDocumentContentJson("not-json")).toBe(false);
    expect(isValidDocumentContentJson(JSON.stringify({ type: "paragraph" }))).toBe(false);
    expect(isValidDocumentContentJson(oversizedContent)).toBe(false);
  });
});
