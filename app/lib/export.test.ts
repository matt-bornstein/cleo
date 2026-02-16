import { downloadFile, exportHtml, exportMarkdown } from "@/lib/export";
import { vi } from "vitest";

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

  it("handles malformed non-string export content safely", () => {
    expect(exportHtml(123 as unknown as string)).toBe("<p></p>");
    expect(exportMarkdown(123 as unknown as string)).toBe("");
  });

  it("normalizes malformed download arguments", () => {
    const click = vi.fn();
    const anchor = { href: "", download: "", click } as unknown as HTMLAnchorElement;
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(anchor as HTMLElementTagNameMap["a"]);
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:local-test");
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL");

    downloadFile(123, "   ", undefined);

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(anchor.download).toBe("download.txt");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:local-test");

    createElementSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });
});
