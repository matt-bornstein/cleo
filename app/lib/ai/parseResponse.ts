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

export function parseAIResponse(response: unknown): ParsedAIResponse {
  const safeResponse = typeof response === "string" ? response : "";
  const fullHtmlMatch = safeResponse.match(FULL_HTML_REGEX);
  const blocks: SearchReplaceBlock[] = [];

  SEARCH_REPLACE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SEARCH_REPLACE_REGEX.exec(safeResponse)) !== null) {
    blocks.push({
      search: typeof match[1] === "string" ? match[1] : "",
      replace: typeof match[2] === "string" ? match[2] : "",
    });
  }

  const explanation = safeResponse
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
  originalHtml: unknown,
  parsed: unknown,
) {
  const safeOriginalHtml = typeof originalHtml === "string" ? originalHtml : "";
  const safeParsed =
    parsed && typeof parsed === "object"
      ? (parsed as { fullHtml?: unknown; blocks?: unknown })
      : undefined;
  const safeFullHtml =
    safeParsed && typeof safeParsed.fullHtml === "string"
      ? safeParsed.fullHtml
      : undefined;
  if (safeFullHtml) {
    return safeFullHtml;
  }

  const safeBlocks = Array.isArray(safeParsed?.blocks) ? safeParsed.blocks : [];
  let nextHtml = safeOriginalHtml;
  for (const block of safeBlocks) {
    if (!block || typeof block !== "object") continue;
    const search = typeof block.search === "string" ? block.search : "";
    const replace = typeof block.replace === "string" ? block.replace : "";
    if (!search) continue;
    nextHtml = nextHtml.replace(search, replace);
  }
  return nextHtml;
}
