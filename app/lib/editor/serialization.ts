import type { JSONContent } from "@tiptap/core";
import { generateHTML, generateJSON } from "@tiptap/html";

import { editorExtensions } from "@/lib/editor/extensions";

const EMPTY_DOCUMENT_HTML = "<p></p>";
const EMPTY_DOCUMENT_JSON = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [] }],
});

export function prosemirrorJsonToHtml(content: unknown) {
  try {
    if (typeof content !== "string") {
      return EMPTY_DOCUMENT_HTML;
    }

    const parsed = JSON.parse(content) as JSONContent | unknown;
    if (!parsed || typeof parsed !== "object") {
      return EMPTY_DOCUMENT_HTML;
    }

    const html = normalizeGeneratedHtml(
      generateHTML(parsed as JSONContent, editorExtensions),
    );
    return html || EMPTY_DOCUMENT_HTML;
  } catch {
    return EMPTY_DOCUMENT_HTML;
  }
}

export function htmlToProsemirrorJson(html: unknown) {
  if (typeof html !== "string" || html.trim().length === 0) {
    return EMPTY_DOCUMENT_JSON;
  }

  try {
    const json = generateJSON(html, editorExtensions);
    return JSON.stringify(json);
  } catch {
    return EMPTY_DOCUMENT_JSON;
  }
}

function normalizeGeneratedHtml(html: string) {
  return html.replaceAll(' xmlns="http://www.w3.org/1999/xhtml"', "");
}
