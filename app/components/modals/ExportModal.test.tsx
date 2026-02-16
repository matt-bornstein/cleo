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

  it("uses untitled fallback filename when title is empty", async () => {
    const user = userEvent.setup();
    render(
      <ExportModal
        open
        onOpenChange={vi.fn()}
        documentTitle=""
        content='{"type":"doc","content":[]}'
      />,
    );

    await user.click(screen.getByRole("button", { name: "Markdown" }));
    expect(downloadFileMock).toHaveBeenCalledWith(
      "# markdown",
      "untitled.md",
      "text/markdown;charset=utf-8",
    );
  });

  it("uses untitled fallback filename when title is malformed non-string", async () => {
    const user = userEvent.setup();
    render(
      <ExportModal
        open
        onOpenChange={vi.fn()}
        documentTitle={123 as unknown as string}
        content='{"type":"doc","content":[]}'
      />,
    );

    await user.click(screen.getByRole("button", { name: "HTML" }));
    expect(downloadFileMock).toHaveBeenCalledWith(
      "<p>html</p>",
      "untitled.html",
      "text/html;charset=utf-8",
    );
  });

  it("sanitizes non-filename characters in export title", async () => {
    const user = userEvent.setup();
    render(
      <ExportModal
        open
        onOpenChange={vi.fn()}
        documentTitle="Quarterly / Roadmap: Q1 2026!"
        content='{"type":"doc","content":[]}'
      />,
    );

    await user.click(screen.getByRole("button", { name: "HTML" }));
    expect(downloadFileMock).toHaveBeenCalledWith(
      "<p>html</p>",
      "quarterly-roadmap-q1-2026.html",
      "text/html;charset=utf-8",
    );
  });

  it("falls back to untitled for symbol-only titles", async () => {
    const user = userEvent.setup();
    render(
      <ExportModal
        open
        onOpenChange={vi.fn()}
        documentTitle="!!!___---"
        content='{"type":"doc","content":[]}'
      />,
    );

    await user.click(screen.getByRole("button", { name: "Markdown" }));
    expect(downloadFileMock).toHaveBeenCalledWith(
      "# markdown",
      "untitled.md",
      "text/markdown;charset=utf-8",
    );
  });

  it("no-ops pdf export when print window cannot open", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    render(
      <ExportModal
        open
        onOpenChange={vi.fn()}
        documentTitle="No Window"
        content='{"type":"doc","content":[]}'
      />,
    );

    await user.click(screen.getByRole("button", { name: "PDF" }));
    expect(openSpy).toHaveBeenCalled();
  });

  it("does not throw when opening print window throws", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "open").mockImplementation(() => {
      throw new Error("open failed");
    });

    render(
      <ExportModal
        open
        onOpenChange={vi.fn()}
        documentTitle="Broken open"
        content='{"type":"doc","content":[]}'
      />,
    );

    await expect(
      user.click(screen.getByRole("button", { name: "PDF" })),
    ).resolves.toBeUndefined();
  });

  it("does not throw when print window methods throw", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "open").mockReturnValue({
      document: {
        write: vi.fn(() => {
          throw new Error("write failed");
        }),
        close: vi.fn(() => {
          throw new Error("close failed");
        }),
      },
      focus: vi.fn(() => {
        throw new Error("focus failed");
      }),
      print: vi.fn(() => {
        throw new Error("print failed");
      }),
    } as unknown as Window);

    render(
      <ExportModal
        open
        onOpenChange={vi.fn()}
        documentTitle="Broken print window"
        content='{"type":"doc","content":[]}'
      />,
    );

    await expect(
      user.click(screen.getByRole("button", { name: "PDF" })),
    ).resolves.toBeUndefined();
  });

  it("does not throw when onOpenChange callback is malformed non-function", async () => {
    const user = userEvent.setup();
    render(
      <ExportModal
        open
        onOpenChange={123 as unknown as (open: boolean) => void}
        documentTitle="Malformed callback"
        content='{"type":"doc","content":[]}'
      />,
    );

    await user.click(screen.getByRole("button", { name: "Markdown" }));
    await user.click(screen.getByRole("button", { name: "HTML" }));
  });

  it("does not throw when export serializers throw", async () => {
    const user = userEvent.setup();
    exportMarkdownMock.mockImplementation(() => {
      throw new Error("markdown failed");
    });
    exportHtmlMock.mockImplementation(() => {
      throw new Error("html failed");
    });

    render(
      <ExportModal
        open
        onOpenChange={vi.fn()}
        documentTitle="Broken serializers"
        content='{"type":"doc","content":[]}'
      />,
    );

    await expect(
      user.click(screen.getByRole("button", { name: "Markdown" })),
    ).resolves.toBeUndefined();
    await expect(
      user.click(screen.getByRole("button", { name: "HTML" })),
    ).resolves.toBeUndefined();
    await expect(
      user.click(screen.getByRole("button", { name: "PDF" })),
    ).resolves.toBeUndefined();
  });

  it("does not throw when onOpenChange callback throws", async () => {
    const user = userEvent.setup();
    render(
      <ExportModal
        open
        onOpenChange={() => {
          throw new Error("onOpenChange failed");
        }}
        documentTitle="Throwing callback"
        content='{"type":"doc","content":[]}'
      />,
    );

    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    await expect(user.click(closeButtons[0])).resolves.toBeUndefined();
  });
});
