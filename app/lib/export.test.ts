import { exportHtml, exportMarkdown } from "@/lib/export";

const sampleContent = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "heading",
      content: [{ type: "text", text: "Title" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Body text" }],
    },
  ],
});

describe("export helpers", () => {
  it("exports html from ProseMirror JSON", () => {
    const html = exportHtml(sampleContent);
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<p>Body text</p>");
  });

  it("exports markdown from ProseMirror JSON", () => {
    const markdown = exportMarkdown(sampleContent);
    expect(markdown).toContain("## Title");
    expect(markdown).toContain("Body text");
  });
});
