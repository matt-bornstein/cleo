import {
  htmlToProsemirrorJson,
  prosemirrorJsonToHtml,
} from "@/lib/editor/serialization";

describe("serialization helpers", () => {
  it("returns empty paragraph html for malformed ProseMirror payloads", () => {
    expect(prosemirrorJsonToHtml("not json")).toBe("<p></p>");
    expect(prosemirrorJsonToHtml("123")).toBe("<p></p>");
    expect(prosemirrorJsonToHtml("null")).toBe("<p></p>");
    expect(prosemirrorJsonToHtml(123)).toBe("<p></p>");
  });

  it("returns empty doc json for malformed html payloads", () => {
    expect(htmlToProsemirrorJson(123)).toBe(
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

  it("preserves underline tags in html-to-prosemirror conversion", () => {
    const serialized = JSON.parse(htmlToProsemirrorJson("<p><u>alligator</u></p>")) as {
      type?: string;
      content?: Array<{
        type?: string;
        content?: Array<{ type?: string; text?: string; marks?: Array<{ type?: string }> }>;
      }>;
    };

    expect(serialized.type).toBe("doc");
    expect(serialized.content?.[0]?.type).toBe("paragraph");
    expect(serialized.content?.[0]?.content?.[0]?.text).toBe("alligator");
    expect(serialized.content?.[0]?.content?.[0]?.marks).toEqual([
      { type: "underline" },
    ]);
  });

  it("renders underline marks and heading level in prosemirror-to-html conversion", () => {
    const html = prosemirrorJsonToHtml(
      JSON.stringify({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [
              {
                type: "text",
                text: "Animal Names",
                marks: [{ type: "underline" }],
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "alligator",
                marks: [{ type: "underline" }],
              },
            ],
          },
        ],
      }),
    );

    expect(html).toContain("<h2><u>Animal Names</u></h2>");
    expect(html).toContain("<p><u>alligator</u></p>");
  });
});
