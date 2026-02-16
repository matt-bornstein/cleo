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
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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
    vi.spyOn(document, "createElement").mockReturnValue(anchor as HTMLElementTagNameMap["a"]);
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:local-test");
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL");

    downloadFile(123, "   ", undefined);

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(anchor.download).toBe("download.txt");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:local-test");

  });

  it("does not throw when object URL creation fails", () => {
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("createObjectURL failed");
    });

    expect(() => downloadFile("content", "file.txt", "text/plain")).not.toThrow();
  });

  it("revokes object URL when anchor click throws", () => {
    const click = vi.fn(() => {
      throw new Error("click failed");
    });
    const anchor = { href: "", download: "", click } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(anchor as HTMLElementTagNameMap["a"]);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-test");
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL");

    expect(() => downloadFile("content", "file.txt", "text/plain")).not.toThrow();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:local-test");
  });

  it("does not throw when creating download anchor throws", () => {
    vi.spyOn(document, "createElement").mockImplementation(() => {
      throw new Error("createElement failed");
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-test");

    expect(() => downloadFile("content", "file.txt", "text/plain")).not.toThrow();
  });

  it("does not throw when object URL revoke throws", () => {
    const click = vi.fn();
    const anchor = { href: "", download: "", click } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(anchor as HTMLElementTagNameMap["a"]);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {
      throw new Error("revokeObjectURL failed");
    });

    expect(() => downloadFile("content", "file.txt", "text/plain")).not.toThrow();
  });
});
