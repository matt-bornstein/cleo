import {
  htmlToProsemirrorJson,
  prosemirrorJsonToHtml,
} from "@/lib/editor/serialization";

describe("serialization helpers", () => {
  it("returns empty paragraph html for malformed ProseMirror payloads", () => {
    expect(prosemirrorJsonToHtml("not json")).toBe("<p></p>");
    expect(prosemirrorJsonToHtml("123")).toBe("<p></p>");
    expect(prosemirrorJsonToHtml("null")).toBe("<p></p>");
    expect(prosemirrorJsonToHtml(123 as unknown as string)).toBe("<p></p>");
  });

  it("returns empty doc json for malformed html payloads", () => {
    expect(htmlToProsemirrorJson(123 as unknown as string)).toBe(
      JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [] }],
      }),
    );
  });

  it("serializes paragraph html into ProseMirror doc json", () => {
    const serialized = htmlToProsemirrorJson("<p>Hello</p>");
    expect(serialized).toBe(
      JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
      }),
    );
  });
});
