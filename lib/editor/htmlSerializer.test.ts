import { describe, it, expect } from "vitest";
import { prosemirrorJsonToHtml } from "./htmlSerializer";

describe("prosemirrorJsonToHtml", () => {
  it("converts a simple paragraph", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    const html = prosemirrorJsonToHtml(doc);
    expect(html).toContain("<p>Hello world</p>");
  });

  it("converts headings", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Subtitle" }],
        },
      ],
    };
    const html = prosemirrorJsonToHtml(doc);
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<h2>Subtitle</h2>");
  });

  it("converts marks (bold, italic, underline, strike, code)", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " " },
            { type: "text", text: "italic", marks: [{ type: "italic" }] },
            { type: "text", text: " " },
            { type: "text", text: "underline", marks: [{ type: "underline" }] },
            { type: "text", text: " " },
            { type: "text", text: "strike", marks: [{ type: "strike" }] },
            { type: "text", text: " " },
            { type: "text", text: "code", marks: [{ type: "code" }] },
          ],
        },
      ],
    };
    const html = prosemirrorJsonToHtml(doc);
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<u>underline</u>");
    expect(html).toContain("<s>strike</s>");
    expect(html).toContain("<code>code</code>");
  });

  it("converts links", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Click here",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
      ],
    };
    const html = prosemirrorJsonToHtml(doc);
    expect(html).toContain('<a href="https://example.com">Click here</a>');
  });

  it("converts bullet lists", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item 1" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item 2" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const html = prosemirrorJsonToHtml(doc);
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>");
    expect(html).toContain("Item 1");
    expect(html).toContain("Item 2");
  });

  it("converts blockquotes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Quoted text" }],
            },
          ],
        },
      ],
    };
    const html = prosemirrorJsonToHtml(doc);
    expect(html).toContain("<blockquote>");
    expect(html).toContain("Quoted text");
  });

  it("converts code blocks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "javascript" },
          content: [{ type: "text", text: "const x = 1;" }],
        },
      ],
    };
    const html = prosemirrorJsonToHtml(doc);
    expect(html).toContain('<pre><code class="language-javascript">');
    expect(html).toContain("const x = 1;");
  });

  it("converts images", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "https://example.com/img.png", alt: "Test image" },
        },
      ],
    };
    const html = prosemirrorJsonToHtml(doc);
    expect(html).toContain('<img src="https://example.com/img.png" alt="Test image">');
  });

  it("converts tables", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Header" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Cell" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const html = prosemirrorJsonToHtml(doc);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>");
    expect(html).toContain("Header");
    expect(html).toContain("<td>");
    expect(html).toContain("Cell");
  });

  it("converts horizontal rules", () => {
    const doc = {
      type: "doc",
      content: [{ type: "horizontalRule" }],
    };
    const html = prosemirrorJsonToHtml(doc);
    expect(html).toContain("<hr>");
  });

  it("escapes HTML entities in text", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "<script>alert('xss')</script>" }],
        },
      ],
    };
    const html = prosemirrorJsonToHtml(doc);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("handles empty doc", () => {
    const doc = { type: "doc", content: [] };
    const html = prosemirrorJsonToHtml(doc);
    expect(html).toBe("");
  });

  it("handles empty paragraphs with br", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
    const html = prosemirrorJsonToHtml(doc);
    expect(html).toContain("<p><br></p>");
  });
});
