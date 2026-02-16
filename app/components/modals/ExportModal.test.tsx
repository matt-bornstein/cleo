import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { ExportModal } from "@/components/modals/ExportModal";

const { downloadFileMock, exportMarkdownMock, exportHtmlMock } = vi.hoisted(() => ({
  downloadFileMock: vi.fn(),
  exportMarkdownMock: vi.fn(() => "# markdown"),
  exportHtmlMock: vi.fn(() => "<p>html</p>"),
}));

vi.mock("@/lib/export", () => ({
  downloadFile: downloadFileMock,
  exportMarkdown: exportMarkdownMock,
  exportHtml: exportHtmlMock,
}));

describe("ExportModal", () => {
  beforeEach(() => {
    downloadFileMock.mockReset();
    exportMarkdownMock.mockClear();
    exportHtmlMock.mockClear();
  });

  it("exports markdown and html with sanitized filenames", async () => {
    const user = userEvent.setup();
    render(
      <ExportModal
        open
        onOpenChange={vi.fn()}
        documentTitle="My Draft Doc"
        content='{"type":"doc","content":[]}'
      />,
    );

    await user.click(screen.getByRole("button", { name: "Markdown" }));
    expect(exportMarkdownMock).toHaveBeenCalled();
    expect(downloadFileMock).toHaveBeenCalledWith(
      "# markdown",
      "my-draft-doc.md",
      "text/markdown;charset=utf-8",
    );

    await user.click(screen.getByRole("button", { name: "HTML" }));
    expect(exportHtmlMock).toHaveBeenCalled();
    expect(downloadFileMock).toHaveBeenCalledWith(
      "<p>html</p>",
      "my-draft-doc.html",
      "text/html;charset=utf-8",
    );
  });

  it("opens print window for pdf export", async () => {
    const user = userEvent.setup();
    const printMock = vi.fn();
    const writeMock = vi.fn();
    const closeMock = vi.fn();
    const focusMock = vi.fn();

    vi.spyOn(window, "open").mockReturnValue({
      document: {
        write: writeMock,
        close: closeMock,
      },
      focus: focusMock,
      print: printMock,
    } as unknown as Window);

    render(
      <ExportModal
        open
        onOpenChange={vi.fn()}
        documentTitle="PDF Doc"
        content='{"type":"doc","content":[]}'
      />,
    );

    await user.click(screen.getByRole("button", { name: "PDF" }));
    expect(writeMock).toHaveBeenCalledWith("<p>html</p>");
    expect(closeMock).toHaveBeenCalled();
    expect(focusMock).toHaveBeenCalled();
    expect(printMock).toHaveBeenCalled();
  });
});
