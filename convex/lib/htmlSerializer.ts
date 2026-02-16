/**
 * Lightweight ProseMirror JSON → HTML serializer.
 * Works in Convex server environment (no DOM required).
 * This is a simplified version that covers the common Tiptap node/mark types.
 */

export function prosemirrorJsonToHtml(node: any): string {
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
      return `<ul data-type="taskList">\n${children}</ul>\n`;
    case "taskItem": {
      const checked = node.attrs?.checked ? ' data-checked="true"' : "";
      return `<li data-type="taskItem"${checked}>${children}</li>\n`;
    }
    case "blockquote":
      return `<blockquote>\n${children}</blockquote>\n`;
    case "codeBlock": {
      const lang = node.attrs?.language
        ? ` class="language-${escapeHtml(node.attrs.language)}"`
        : "";
      return `<pre><code${lang}>${children}</code></pre>\n`;
    }
    case "horizontalRule":
      return `<hr>\n`;
    case "hardBreak":
      return `<br>`;
    case "image": {
      const src = escapeHtml(node.attrs?.src || "");
      const alt = escapeHtml(node.attrs?.alt || "");
      const title = node.attrs?.title
        ? ` title="${escapeHtml(node.attrs.title)}"`
        : "";
      return `<img src="${src}" alt="${alt}"${title}>\n`;
    }
    case "table":
      return `<table>\n<tbody>\n${children}</tbody>\n</table>\n`;
    case "tableRow":
      return `<tr>${children}</tr>\n`;
    case "tableCell": {
      const colspan =
        node.attrs?.colspan > 1 ? ` colspan="${node.attrs.colspan}"` : "";
      const rowspan =
        node.attrs?.rowspan > 1 ? ` rowspan="${node.attrs.rowspan}"` : "";
      return `<td${colspan}${rowspan}>${children}</td>`;
    }
    case "tableHeader": {
      const colspan =
        node.attrs?.colspan > 1 ? ` colspan="${node.attrs.colspan}"` : "";
      const rowspan =
        node.attrs?.rowspan > 1 ? ` rowspan="${node.attrs.rowspan}"` : "";
      return `<th${colspan}${rowspan}>${children}</th>`;
    }
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
