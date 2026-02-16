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
    objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = normalizedFilename;
    if (typeof anchor.click === "function") {
      anchor.click();
    }
  } catch {
    return;
  } finally {
    if (typeof objectUrl === "string" && objectUrl.length > 0) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
