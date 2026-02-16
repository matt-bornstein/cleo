import { isValidDocumentContentJson } from "@/lib/ai/documentContent";
import { vi } from "vitest";

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
    expect(isValidDocumentContentJson(JSON.stringify({ type: "doc" }))).toBe(false);
    expect(isValidDocumentContentJson(JSON.stringify({ type: "doc", content: {} }))).toBe(
      false,
    );
    expect(isValidDocumentContentJson(JSON.stringify({ type: "paragraph" }))).toBe(false);
    expect(isValidDocumentContentJson(oversizedContent)).toBe(false);
    expect(isValidDocumentContentJson(null)).toBe(false);
    expect(isValidDocumentContentJson(123)).toBe(false);
  });

  it("returns false when parsed document content getters throw", () => {
    const parsedWithThrowingGetters = Object.create(null) as {
      type: unknown;
      content: unknown;
    };
    Object.defineProperty(parsedWithThrowingGetters, "type", {
      get() {
        throw new Error("type getter failed");
      },
    });
    Object.defineProperty(parsedWithThrowingGetters, "content", {
      get() {
        throw new Error("content getter failed");
      },
    });
    vi.spyOn(JSON, "parse").mockReturnValue(parsedWithThrowingGetters);

    expect(isValidDocumentContentJson("{\"type\":\"doc\",\"content\":[]}")).toBe(false);
    vi.restoreAllMocks();
  });
});
