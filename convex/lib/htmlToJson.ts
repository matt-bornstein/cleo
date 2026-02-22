/**
 * Simple HTML → ProseMirror JSON converter for server-side use (no DOM required).
 * Uses a state-machine approach instead of regex for more reliable parsing.
 */

interface ProseMirrorNode {
  type: string;
  attrs?: Record<string, any>;
  content?: ProseMirrorNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, any> }[];
}

export function htmlToProsemirrorJson(html: string): ProseMirrorNode {
  const trimmed = html.trim();
  if (!trimmed) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  const tokens = tokenize(trimmed);
  const children = buildNodes(tokens);
  return {
    type: "doc",
    content: children.length > 0 ? children : [{ type: "paragraph" }],
  };
}

// ---- Tokenizer ----

interface Token {
  type: "open" | "close" | "selfclose" | "text";
  tag?: string;
  attrs?: string;
  text?: string;
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < html.length) {
    if (html[i] === "<") {
      const closeIdx = html.indexOf(">", i);
      if (closeIdx === -1) {
        // Malformed — treat rest as text
        tokens.push({ type: "text", text: html.substring(i) });
        break;
      }

      const tagContent = html.substring(i + 1, closeIdx);

      if (tagContent.startsWith("/")) {
        // Closing tag
        const tag = tagContent.substring(1).trim().split(/\s/)[0].toLowerCase();
        tokens.push({ type: "close", tag });
      } else if (tagContent.endsWith("/") || isSelfClosingTag(tagContent.split(/\s/)[0].toLowerCase())) {
        // Self-closing
        const parts = tagContent.replace(/\/$/, "").trim();
        const tag = parts.split(/\s/)[0].toLowerCase();
        const attrs = parts.substring(tag.length).trim();
        tokens.push({ type: "selfclose", tag, attrs });
      } else {
        // Opening tag
        const tag = tagContent.split(/\s/)[0].toLowerCase();
        const attrs = tagContent.substring(tag.length).trim();
        tokens.push({ type: "open", tag, attrs });
      }

      i = closeIdx + 1;
    } else {
      // Text content
      let end = html.indexOf("<", i);
      if (end === -1) end = html.length;
      const text = html.substring(i, end);
      if (text) {
        tokens.push({ type: "text", text });
      }
      i = end;
    }
  }

  return tokens;
}

function isSelfClosingTag(tag: string): boolean {
  return ["br", "hr", "img", "input", "meta", "link"].includes(tag);
}

// ---- Node builder ----

function buildNodes(tokens: Token[]): ProseMirrorNode[] {
  const nodes: ProseMirrorNode[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === "text") {
      const text = token.text!;
      // Only add non-whitespace text
      if (text.trim()) {
        // Wrap bare text in paragraph
        nodes.push({
          type: "paragraph",
          content: [{ type: "text", text: unescapeHtml(text) }],
        });
      }
      i++;
      continue;
    }

    if (token.type === "selfclose") {
      const node = handleSelfClose(token);
      if (node) nodes.push(node);
      i++;
      continue;
    }

    if (token.type === "close") {
      // Skip stray closing tags
      i++;
      continue;
    }

    if (token.type === "open") {
      // Find matching close tag and extract inner tokens
      const { innerTokens, endIndex } = extractInner(tokens, i);

      if (isBlockTag(token.tag!)) {
        const node = buildBlockNode(token.tag!, token.attrs || "", innerTokens);
        if (node) nodes.push(node);
      } else if (isInlineTag(token.tag!)) {
        // Inline tag at top level — wrap in paragraph
        const inlineNodes = buildInlineNodes([token, ...innerTokens, { type: "close", tag: token.tag }]);
        if (inlineNodes.length > 0) {
          nodes.push({ type: "paragraph", content: inlineNodes });
        }
      }

      i = endIndex + 1;
      continue;
    }

    i++;
  }

  return nodes;
}

function extractInner(tokens: Token[], openIdx: number): { innerTokens: Token[]; endIndex: number } {
  const tag = tokens[openIdx].tag!;
  let depth = 1;
  let i = openIdx + 1;

  while (i < tokens.length && depth > 0) {
    if (tokens[i].type === "open" && tokens[i].tag === tag) depth++;
    if (tokens[i].type === "close" && tokens[i].tag === tag) depth--;
    if (depth === 0) break;
    i++;
  }

  return {
    innerTokens: tokens.slice(openIdx + 1, i),
    endIndex: i,
  };
}

function buildBlockNode(tag: string, attrsStr: string, innerTokens: Token[]): ProseMirrorNode | null {
  switch (tag) {
    case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
      return {
        type: "heading",
        attrs: { level: Math.min(parseInt(tag[1]), 3) },
        content: buildInlineNodes(innerTokens),
      };

    case "p":
      return {
        type: "paragraph",
        content: buildInlineNodes(innerTokens).length > 0
          ? buildInlineNodes(innerTokens)
          : undefined,
      };

    case "ul":
      return { type: "bulletList", content: buildListItems(innerTokens) };

    case "ol":
      return { type: "orderedList", content: buildListItems(innerTokens) };

    case "li": {
      const hasBlock = innerTokens.some(
        (t) => t.type === "open" && isBlockTag(t.tag!)
      );
      if (hasBlock) {
        const blockContent = buildNodes(innerTokens);
        return {
          type: "listItem",
          content: blockContent.length > 0 ? blockContent : [{ type: "paragraph" }],
        };
      }
      return {
        type: "listItem",
        content: [{ type: "paragraph", content: buildInlineNodes(innerTokens) }],
      };
    }

    case "blockquote":
      return { type: "blockquote", content: buildNodes(innerTokens) };

    case "pre": {
      const text = extractTextFromTokens(innerTokens);
      return {
        type: "codeBlock",
        content: text ? [{ type: "text", text: unescapeHtml(text) }] : undefined,
      };
    }

    case "table": {
      // Filter out tbody
      const rowTokens = innerTokens.filter(t => !(t.type === "open" && t.tag === "tbody") && !(t.type === "close" && t.tag === "tbody"));
      return { type: "table", content: buildTableRows(rowTokens) };
    }

    case "tbody":
      return null; // Skip, handled by table

    case "tr":
      return { type: "tableRow", content: buildTableCells(innerTokens) };

    case "td":
      return {
        type: "tableCell",
        content: [{ type: "paragraph", content: buildInlineNodes(innerTokens) }],
      };

    case "th":
      return {
        type: "tableHeader",
        content: [{ type: "paragraph", content: buildInlineNodes(innerTokens) }],
      };

    case "hr":
      return { type: "horizontalRule" };

    default:
      return null;
  }
}

function handleSelfClose(token: Token): ProseMirrorNode | null {
  switch (token.tag) {
    case "hr":
      return { type: "horizontalRule" };
    case "br":
      return { type: "hardBreak" };
    case "img":
      return {
        type: "image",
        attrs: {
          src: extractAttr(token.attrs || "", "src"),
          alt: extractAttr(token.attrs || "", "alt"),
        },
      };
    default:
      return null;
  }
}

function buildInlineNodes(tokens: Token[]): ProseMirrorNode[] {
  const nodes: ProseMirrorNode[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === "text") {
      const text = unescapeHtml(token.text!);
      if (text) {
        nodes.push({ type: "text", text });
      }
      i++;
      continue;
    }

    if (token.type === "selfclose") {
      if (token.tag === "br") {
        nodes.push({ type: "hardBreak" });
      }
      i++;
      continue;
    }

    if (token.type === "close") {
      i++;
      continue;
    }

    if (token.type === "open" && isInlineTag(token.tag!)) {
      const { innerTokens, endIndex } = extractInner(tokens, i);
      const markType = getMarkType(token.tag!);

      if (markType) {
        const childNodes = buildInlineNodes(innerTokens);
        const markObj: { type: string; attrs?: Record<string, any> } = { type: markType };
        if (token.tag === "a") {
          markObj.attrs = { href: extractAttr(token.attrs || "", "href") };
        }

        for (const child of childNodes) {
          if (child.type === "text") {
            const marks = [...(child.marks || []), markObj];
            nodes.push({ ...child, marks });
          } else {
            nodes.push(child);
          }
        }
      }

      i = endIndex + 1;
      continue;
    }

    // Block tags inside inline context — skip open, process inner
    if (token.type === "open") {
      const { innerTokens, endIndex } = extractInner(tokens, i);
      // Just flatten the inner tokens
      nodes.push(...buildInlineNodes(innerTokens));
      i = endIndex + 1;
      continue;
    }

    i++;
  }

  return nodes;
}

function buildListItems(tokens: Token[]): ProseMirrorNode[] {
  const items: ProseMirrorNode[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === "open" && token.tag === "li") {
      const { innerTokens, endIndex } = extractInner(tokens, i);

      // Check if the <li> contains block-level elements (e.g. <p>, <ul>, <ol>)
      const hasBlockContent = innerTokens.some(
        (t) => t.type === "open" && isBlockTag(t.tag!)
      );

      if (hasBlockContent) {
        // Parse block content properly (handles <li><p>text</p></li>,
        // nested lists, and multi-paragraph items)
        const blockContent = buildNodes(innerTokens);
        items.push({
          type: "listItem",
          content: blockContent.length > 0
            ? blockContent
            : [{ type: "paragraph" }],
        });
      } else {
        // Simple inline content: <li>text</li>
        items.push({
          type: "listItem",
          content: [{
            type: "paragraph",
            content: buildInlineNodes(innerTokens),
          }],
        });
      }

      i = endIndex + 1;
    } else {
      i++;
    }
  }

  return items;
}

function buildTableRows(tokens: Token[]): ProseMirrorNode[] {
  const rows: ProseMirrorNode[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === "open" && token.tag === "tr") {
      const { innerTokens, endIndex } = extractInner(tokens, i);
      rows.push({
        type: "tableRow",
        content: buildTableCells(innerTokens),
      });
      i = endIndex + 1;
    } else {
      i++;
    }
  }

  return rows;
}

function buildTableCells(tokens: Token[]): ProseMirrorNode[] {
  const cells: ProseMirrorNode[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === "open" && (token.tag === "td" || token.tag === "th")) {
      const { innerTokens, endIndex } = extractInner(tokens, i);
      cells.push({
        type: token.tag === "th" ? "tableHeader" : "tableCell",
        content: [{
          type: "paragraph",
          content: buildInlineNodes(innerTokens),
        }],
      });
      i = endIndex + 1;
    } else {
      i++;
    }
  }

  return cells;
}

function extractTextFromTokens(tokens: Token[]): string {
  let text = "";
  for (const token of tokens) {
    if (token.type === "text") {
      text += token.text;
    } else if (token.type === "open" || token.type === "close") {
      // Skip tags but continue collecting text
      continue;
    }
  }
  return text;
}

// ---- Helpers ----

function isBlockTag(tag: string): boolean {
  return [
    "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "pre",
    "table", "tbody", "tr", "td", "th", "hr",
  ].includes(tag);
}

function isInlineTag(tag: string): boolean {
  return ["strong", "b", "em", "i", "u", "s", "del", "code", "a", "span"].includes(tag);
}

function getMarkType(tag: string): string | null {
  switch (tag) {
    case "strong": case "b": return "bold";
    case "em": case "i": return "italic";
    case "u": return "underline";
    case "s": case "del": return "strike";
    case "code": return "code";
    case "a": return "link";
    default: return null;
  }
}

function extractAttr(attrsStr: string, name: string): string {
  const match = attrsStr.match(new RegExp(`${name}=["']([^"']*)["']`));
  return match ? unescapeHtml(match[1]) : "";
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}
