import { prosemirrorJsonToHtml } from "@/lib/editor/serialization";

export function exportHtml(content: unknown) {
  const normalizedContent = typeof content === "string" ? content : "";
  return prosemirrorJsonToHtml(normalizedContent);
}

export function exportMarkdown(content: unknown) {
  const html = exportHtml(content);
  return html
    .replace(/<h1>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2>(.*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3>(.*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<p>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<li>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function downloadFile(content: unknown, filename: unknown, mimeType: unknown) {
  const normalizedContent = typeof content === "string" ? content : "";
  const normalizedFilename =
    typeof filename === "string" && filename.trim().length > 0
      ? filename.trim()
      : "download.txt";
  const normalizedMimeType =
    typeof mimeType === "string" && mimeType.trim().length > 0
      ? mimeType.trim()
      : "text/plain;charset=utf-8";

  let objectUrl: string | undefined;

  try {
    const blob = new Blob([normalizedContent], { type: normalizedMimeType });
    objectUrl = safeCreateObjectURL(blob);
    if (typeof objectUrl !== "string" || objectUrl.length === 0) {
      return;
    }
    const anchor = safeCreateDownloadAnchor();
    if (!anchor) {
      return;
    }
    safePrepareAnchor(anchor, objectUrl, normalizedFilename);
    safeClickAnchor(anchor);
  } catch {
    return;
  } finally {
    safeRevokeObjectURL(objectUrl);
  }
}

function safeCreateObjectURL(blob: Blob) {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return undefined;
  }

  try {
    return URL.createObjectURL(blob);
  } catch {
    return undefined;
  }
}

function safeCreateDownloadAnchor() {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return null;
  }

  try {
    return document.createElement("a");
  } catch {
    return null;
  }
}

function safePrepareAnchor(anchor: HTMLAnchorElement, href: string, download: string) {
  try {
    anchor.href = href;
    anchor.download = download;
  } catch {
    return;
  }
}

function safeClickAnchor(anchor: HTMLAnchorElement) {
  try {
    if (typeof anchor.click === "function") {
      anchor.click();
    }
  } catch {
    return;
  }
}

function safeRevokeObjectURL(objectUrl: unknown) {
  if (
    typeof objectUrl !== "string" ||
    objectUrl.length === 0 ||
    typeof URL === "undefined" ||
    typeof URL.revokeObjectURL !== "function"
  ) {
    return;
  }

  try {
    URL.revokeObjectURL(objectUrl);
  } catch {
    return;
  }
}
