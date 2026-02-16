import { describe, it, expect } from "vitest";
// Import from the convex lib directory using a relative path trick
// The actual module is the same logic we need to test
import { htmlToProsemirrorJson } from "../../convex/lib/htmlToJson";

describe("htmlToProsemirrorJson", () => {
  it("converts simple paragraphs", () => {
    const doc = htmlToProsemirrorJson("<p>Hello world</p>");
    expect(doc.type).toBe("doc");
    expect(doc.content).toHaveLength(1);
    expect(doc.content![0].type).toBe("paragraph");
    expect(doc.content![0].content![0].text).toBe("Hello world");
  });

  it("converts headings", () => {
    const doc = htmlToProsemirrorJson("<h1>Title</h1><h2>Subtitle</h2>");
    expect(doc.content).toHaveLength(2);
    expect(doc.content![0].type).toBe("heading");
    expect(doc.content![0].attrs?.level).toBe(1);
    expect(doc.content![1].attrs?.level).toBe(2);
  });

  it("converts bold and italic", () => {
    const doc = htmlToProsemirrorJson("<p><strong>bold</strong> and <em>italic</em></p>");
    expect(doc.content![0].content).toHaveLength(3);
    const boldNode = doc.content![0].content![0];
    expect(boldNode.text).toBe("bold");
    expect(boldNode.marks).toContainEqual({ type: "bold" });
  });

  it("converts bullet lists", () => {
    const doc = htmlToProsemirrorJson("<ul><li>Item 1</li><li>Item 2</li></ul>");
    expect(doc.content![0].type).toBe("bulletList");
    expect(doc.content![0].content).toHaveLength(2);
  });

  it("converts ordered lists", () => {
    const doc = htmlToProsemirrorJson("<ol><li>First</li><li>Second</li></ol>");
    expect(doc.content![0].type).toBe("orderedList");
    expect(doc.content![0].content).toHaveLength(2);
  });

  it("converts blockquotes", () => {
    const doc = htmlToProsemirrorJson("<blockquote><p>Quoted text</p></blockquote>");
    expect(doc.content![0].type).toBe("blockquote");
  });

  it("converts code blocks", () => {
    const doc = htmlToProsemirrorJson("<pre><code>const x = 1;</code></pre>");
    expect(doc.content![0].type).toBe("codeBlock");
    expect(doc.content![0].content![0].text).toBe("const x = 1;");
  });

  it("converts horizontal rules", () => {
    const doc = htmlToProsemirrorJson("<hr>");
    expect(doc.content![0].type).toBe("horizontalRule");
  });

  it("converts links", () => {
    const doc = htmlToProsemirrorJson('<p><a href="https://example.com">Click</a></p>');
    const link = doc.content![0].content![0];
    expect(link.text).toBe("Click");
    expect(link.marks).toContainEqual({
      type: "link",
      attrs: { href: "https://example.com" },
    });
  });

  it("converts images", () => {
    const doc = htmlToProsemirrorJson('<img src="test.png" alt="Test">');
    expect(doc.content![0].type).toBe("image");
    expect(doc.content![0].attrs?.src).toBe("test.png");
    expect(doc.content![0].attrs?.alt).toBe("Test");
  });

  it("handles empty HTML", () => {
    const doc = htmlToProsemirrorJson("");
    expect(doc.type).toBe("doc");
    expect(doc.content).toHaveLength(1);
    expect(doc.content![0].type).toBe("paragraph");
  });

  it("unescapes HTML entities", () => {
    const doc = htmlToProsemirrorJson("<p>&lt;script&gt;alert(&amp;quot;xss&amp;quot;)&lt;/script&gt;</p>");
    expect(doc.content![0].content![0].text).toContain("<script>");
  });
});
