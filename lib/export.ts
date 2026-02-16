/**
 * Export document content in various formats.
 * These functions work with ProseMirror JSON content strings.
 */

import TurndownService from "turndown";

/**
 * Export as HTML - renders ProseMirror JSON to basic HTML
 * For a complete rendering, use the Tiptap editor's getHTML() method.
 */
export function exportAsHtml(
  contentJson: string,
  title: string
): string {
  try {
    const doc = JSON.parse(contentJson);
    const html = prosemirrorJsonToHtml(doc);
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { font-size: 2em; margin-top: 1em; }
    h2 { font-size: 1.5em; margin-top: 0.8em; }
    h3 { font-size: 1.25em; margin-top: 0.6em; }
    blockquote { border-left: 3px solid #ddd; padding-left: 1rem; color: #666; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    code { background: #f4f4f4; padding: 0.125rem 0.25rem; border-radius: 3px; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #ddd; padding: 0.5rem; }
    th { background: #f9f9f9; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #ddd; margin: 1.5rem 0; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
  } catch {
    return `<html><body><p>Error exporting document</p></body></html>`;
  }
}

/**
 * Export as Markdown - converts ProseMirror JSON → HTML → Markdown via turndown
 */
export function exportAsMarkdown(contentJson: string): string {
  try {
    const doc = JSON.parse(contentJson);
    const html = prosemirrorJsonToHtml(doc);
    const turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
    });
    // Add task list support
    turndownService.addRule("taskListItem", {
      filter: (node) => {
        return (
          node.nodeName === "LI" &&
          node.getAttribute("data-type") === "taskItem"
        );
      },
      replacement: (_content, node) => {
        const checked = (node as Element).getAttribute("data-checked") === "true";
        const text = _content.trim();
        return `- [${checked ? "x" : " "}] ${text}\n`;
      },
    });
    return turndownService.turndown(html);
  } catch {
    return "Error exporting document";
  }
}

/**
 * Export as Markdown from live editor HTML
 */
export function htmlToMarkdown(html: string): string {
  try {
    const turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
    });
    return turndownService.turndown(html);
  } catch {
    return "Error converting to markdown";
  }
}

/**
 * Export as plain text - strips all formatting
 */
export function exportAsText(contentJson: string): string {
  try {
    const doc = JSON.parse(contentJson);
    return prosemirrorJsonToText(doc);
  } catch {
    return "Error exporting document";
  }
}

/**
 * Convert ProseMirror JSON to HTML (simplified)
 */
function prosemirrorJsonToHtml(node: any): string {
  if (!node) return "";

  if (node.type === "text") {
    let text = escapeHtml(node.text || "");
    if (node.marks) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case "bold":
            text = `<strong>${text}</strong>`;
            break;
          case "italic":
            text = `<em>${text}</em>`;
            break;
          case "underline":
            text = `<u>${text}</u>`;
            break;
          case "strike":
            text = `<s>${text}</s>`;
            break;
          case "code":
            text = `<code>${text}</code>`;
            break;
          case "link":
            text = `<a href="${escapeHtml(mark.attrs?.href || "")}">${text}</a>`;
            break;
        }
      }
    }
    return text;
  }

  const children = (node.content || [])
    .map((child: any) => prosemirrorJsonToHtml(child))
    .join("");

  switch (node.type) {
    case "doc":
      return children;
    case "paragraph":
      return `<p>${children || "<br>"}</p>\n`;
    case "heading": {
      const level = node.attrs?.level || 1;
      return `<h${level}>${children}</h${level}>\n`;
    }
    case "bulletList":
      return `<ul>\n${children}</ul>\n`;
    case "orderedList":
      return `<ol>\n${children}</ol>\n`;
    case "listItem":
      return `<li>${children}</li>\n`;
    case "taskList":
      return `<ul>\n${children}</ul>\n`;
    case "taskItem": {
      const checked = node.attrs?.checked ? "checked" : "";
      return `<li><input type="checkbox" ${checked} disabled> ${children}</li>\n`;
    }
    case "blockquote":
      return `<blockquote>\n${children}</blockquote>\n`;
    case "codeBlock":
      return `<pre><code>${children}</code></pre>\n`;
    case "horizontalRule":
      return `<hr>\n`;
    case "hardBreak":
      return `<br>`;
    case "image":
      return `<img src="${escapeHtml(node.attrs?.src || "")}" alt="${escapeHtml(node.attrs?.alt || "")}">\n`;
    case "table":
      return `<table>\n${children}</table>\n`;
    case "tableRow":
      return `<tr>${children}</tr>\n`;
    case "tableCell":
      return `<td>${children}</td>`;
    case "tableHeader":
      return `<th>${children}</th>`;
    default:
      return children;
  }
}

/**
 * Convert ProseMirror JSON to plain text
 */
function prosemirrorJsonToText(node: any): string {
  if (!node) return "";

  if (node.type === "text") {
    return node.text || "";
  }

  const children = (node.content || [])
    .map((child: any) => prosemirrorJsonToText(child))
    .join("");

  switch (node.type) {
    case "doc":
      return children;
    case "paragraph":
      return children + "\n\n";
    case "heading":
      return children + "\n\n";
    case "bulletList":
    case "orderedList":
    case "taskList":
      return children + "\n";
    case "listItem":
    case "taskItem":
      return "  • " + children + "\n";
    case "blockquote":
      return children
        .split("\n")
        .map((l: string) => "> " + l)
        .join("\n") + "\n";
    case "codeBlock":
      return "```\n" + children + "\n```\n\n";
    case "horizontalRule":
      return "---\n\n";
    case "hardBreak":
      return "\n";
    default:
      return children;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
