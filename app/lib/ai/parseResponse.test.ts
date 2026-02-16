import { applyParsedEditsToHtml, parseAIResponse } from "@/lib/ai/parseResponse";

describe("parseAIResponse", () => {
  it("parses search/replace blocks with explanation", () => {
    const response = `
Updated intro paragraph.

<<<SEARCH
<p>Old text</p>
===
<p>New text</p>
>>>
`;

    const parsed = parseAIResponse(response);
    expect(parsed.explanation).toContain("Updated intro paragraph.");
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0].search).toBe("<p>Old text</p>");
    expect(parsed.blocks[0].replace).toBe("<p>New text</p>");
  });

  it("parses full html fallback and applies it", () => {
    const response = `
Rewrote section.
\`\`\`html
<p>Completely new content</p>
\`\`\`
`;
    const parsed = parseAIResponse(response);
    const nextHtml = applyParsedEditsToHtml("<p>Old</p>", parsed);
    expect(nextHtml).toBe("<p>Completely new content</p>");
  });
});
