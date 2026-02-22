export interface SearchReplaceBlock {
  search: string;
  replace: string;
}

export interface ParsedAIResponse {
  explanation: string;
  type: "search_replace" | "full_html" | "text_only";
  blocks?: SearchReplaceBlock[];
  fullHtml?: string;
}

/**
 * Parse the AI response to extract search/replace blocks or full HTML.
 */
export function parseAIResponse(response: string): ParsedAIResponse {
  const blocks = extractSearchReplaceBlocks(response);
  if (blocks.length > 0) {
    // Get explanation text (everything before the first block)
    const firstBlockIdx = response.indexOf("<<<SEARCH");
    const explanation = firstBlockIdx > 0
      ? response.substring(0, firstBlockIdx).trim()
      : "";
    return {
      explanation,
      type: "search_replace",
      blocks,
    };
  }

  const fullHtml = extractFullHtml(response);
  if (fullHtml) {
    // Get explanation text (everything before the code fence)
    const fenceIdx = response.indexOf("```html");
    const explanation = fenceIdx > 0
      ? response.substring(0, fenceIdx).trim()
      : "";
    return {
      explanation,
      type: "full_html",
      fullHtml,
    };
  }

  // No edits detected - just a text response
  return {
    explanation: response,
    type: "text_only",
  };
}

/**
 * Extract search/replace blocks from the response.
 * Format:
 * <<<SEARCH
 * <p>text to find</p>
 * ===
 * <p>replacement text</p>
 * >>>
 */
function extractSearchReplaceBlocks(response: string): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = [];
  const regex = /<<<SEARCH\n([\s\S]*?)\n===\n([\s\S]*?)>>>/g;
  let match;

  while ((match = regex.exec(response)) !== null) {
    blocks.push({
      search: match[1].trim(),
      replace: match[2].trim(),
    });
  }

  return blocks;
}

/**
 * Extract full HTML from a code fence.
 * Format:
 * ```html
 * <full document HTML>
 * ```
 */
function extractFullHtml(response: string): string | null {
  const regex = /```html\n([\s\S]*?)\n```/;
  const match = regex.exec(response);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * Apply search/replace blocks to the original HTML.
 */
export function applySearchReplace(
  originalHtml: string,
  blocks: SearchReplaceBlock[]
): string {
  let html = originalHtml;
  for (const block of blocks) {
    if (html.includes(block.search)) {
      html = html.replace(block.search, block.replace);
    } else {
      console.warn(
        "Search block not found in document:",
        block.search.substring(0, 100)
      );
    }
  }
  return html;
}
