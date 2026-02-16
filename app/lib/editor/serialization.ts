type JSONContent = {
  type?: string;
  text?: string;
  content?: JSONContent[];
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nodeToHtml(node: JSONContent): string {
  if (node.type === "text") {
    return escapeHtml(node.text ?? "");
  }

  const children = (node.content ?? []).map(nodeToHtml).join("");

  switch (node.type) {
    case "heading":
      return `<h2>${children}</h2>`;
    case "paragraph":
      return `<p>${children}</p>`;
    case "bulletList":
      return `<ul>${children}</ul>`;
    case "orderedList":
      return `<ol>${children}</ol>`;
    case "listItem":
      return `<li>${children}</li>`;
    case "doc":
      return children || "<p></p>";
    default:
      return children;
  }
}

export function prosemirrorJsonToHtml(content: string) {
  try {
    const parsed = JSON.parse(content) as JSONContent;
    return nodeToHtml(parsed);
  } catch {
    return "<p></p>";
  }
}

export function htmlToProsemirrorJson(html: string) {
  const paragraphMatches = [...html.matchAll(/<p>([\s\S]*?)<\/p>/gi)];
  const paragraphs = paragraphMatches.length > 0 ? paragraphMatches : [[html, html]];

  const content = paragraphs.map((match) => {
    const text = (match[1] ?? "")
      .replace(/<[^>]+>/g, "")
      .replaceAll("&nbsp;", " ")
      .trim();
    return {
      type: "paragraph",
      content: text ? [{ type: "text", text }] : [],
    };
  });

  return JSON.stringify({
    type: "doc",
    content,
  });
}
