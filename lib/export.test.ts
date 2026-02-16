import { describe, it, expect } from "vitest";
import { exportAsHtml, exportAsText } from "./export";

describe("exportAsHtml", () => {
  it("exports a simple document", () => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Hello World" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "This is a test document." }],
        },
      ],
    });

    const html = exportAsHtml(content, "Test Doc");
    expect(html).toContain("<h1>Hello World</h1>");
    expect(html).toContain("<p>This is a test document.</p>");
    expect(html).toContain("<title>Test Doc</title>");
  });

  it("handles bold and italic marks", () => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "bold text",
              marks: [{ type: "bold" }],
            },
            { type: "text", text: " and " },
            {
              type: "text",
              text: "italic text",
              marks: [{ type: "italic" }],
            },
          ],
        },
      ],
    });

    const html = exportAsHtml(content, "Test");
    expect(html).toContain("<strong>bold text</strong>");
    expect(html).toContain("<em>italic text</em>");
  });

  it("handles lists", () => {
    const content = JSON.stringify({
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
    });

    const html = exportAsHtml(content, "Test");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>");
    expect(html).toContain("Item 1");
    expect(html).toContain("Item 2");
  });
});

describe("exportAsText", () => {
  it("exports plain text", () => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Hello" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "World" }],
        },
      ],
    });

    const text = exportAsText(content);
    expect(text).toContain("Hello");
    expect(text).toContain("World");
  });

  it("strips formatting marks", () => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "bold text",
              marks: [{ type: "bold" }],
            },
          ],
        },
      ],
    });

    const text = exportAsText(content);
    expect(text).toContain("bold text");
    expect(text).not.toContain("<strong>");
  });
});
