export type SearchReplaceBlock = {
  search: string;
  replace: string;
};

export type ParsedAIResponse = {
  explanation: string;
  fullHtml?: string;
  blocks: SearchReplaceBlock[];
};

const SEARCH_REPLACE_REGEX =
  /<<<SEARCH\s*([\s\S]*?)\s*===\s*([\s\S]*?)\s*>>>/g;
const FULL_HTML_REGEX = /```html\s*([\s\S]*?)\s*```/i;

export function parseAIResponse(response: string): ParsedAIResponse {
  const fullHtmlMatch = response.match(FULL_HTML_REGEX);
  const blocks: SearchReplaceBlock[] = [];

  let match: RegExpExecArray | null;
  while ((match = SEARCH_REPLACE_REGEX.exec(response)) !== null) {
    blocks.push({
      search: match[1],
      replace: match[2],
    });
  }

  const explanation = response
    .replace(FULL_HTML_REGEX, "")
    .replace(SEARCH_REPLACE_REGEX, "")
    .trim();

  return {
    explanation,
    fullHtml: fullHtmlMatch?.[1]?.trim(),
    blocks,
  };
}

export function applyParsedEditsToHtml(
  originalHtml: string,
  parsed: ParsedAIResponse,
) {
  if (parsed.fullHtml) {
    return parsed.fullHtml;
  }

  let nextHtml = originalHtml;
  for (const block of parsed.blocks) {
    if (!block.search) continue;
    nextHtml = nextHtml.replace(block.search, block.replace);
  }
  return nextHtml;
}
