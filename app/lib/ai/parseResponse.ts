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
const HTML_START_REGEX = /<[a-zA-Z][\w:-]*(\s[^<>]*)?>/;

export function parseAIResponse(response: unknown): ParsedAIResponse {
  const safeResponse = typeof response === "string" ? response : "";
  const fullHtmlMatch = safeResponse.match(FULL_HTML_REGEX);
  const inferredFullHtml = !fullHtmlMatch ? inferFullHtmlFromResponse(safeResponse) : undefined;
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
    .replace(inferredFullHtml ?? "", "")
    .trim();

  return {
    explanation,
    fullHtml: fullHtmlMatch?.[1]?.trim() ?? inferredFullHtml,
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
  const fullHtml = readParsedField(safeParsed, "fullHtml");
  const safeFullHtml =
    typeof fullHtml === "string"
      ? fullHtml
      : undefined;
  if (safeFullHtml) {
    return safeFullHtml;
  }

  const blocks = readParsedField(safeParsed, "blocks");
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  let nextHtml = safeOriginalHtml;
  for (const block of safeBlocks) {
    if (!block || typeof block !== "object") continue;
    const search = readBlockField(block, "search");
    const replace = readBlockField(block, "replace");
    const normalizedSearch = typeof search === "string" ? search : "";
    const normalizedReplace = typeof replace === "string" ? replace : "";
    if (!normalizedSearch) continue;
    nextHtml = nextHtml.replace(normalizedSearch, normalizedReplace);
  }
  return nextHtml;
}

function readParsedField(
  parsed: { fullHtml?: unknown; blocks?: unknown } | undefined,
  key: "fullHtml" | "blocks",
) {
  if (!parsed) {
    return undefined;
  }

  try {
    return parsed[key];
  } catch {
    return undefined;
  }
}

function readBlockField(block: object, key: "search" | "replace") {
  try {
    return (block as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

function inferFullHtmlFromResponse(response: string) {
  const match = response.match(HTML_START_REGEX);
  if (!match?.index && match?.index !== 0) {
    return undefined;
  }

  const candidate = response.slice(match.index).trim();
  if (!candidate || !candidate.includes(">")) {
    return undefined;
  }

  return candidate;
}
