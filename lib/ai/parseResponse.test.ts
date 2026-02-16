import { describe, it, expect } from "vitest";
import {
  parseAIResponse,
  applySearchReplace,
} from "./parseResponse";

describe("parseAIResponse", () => {
  it("parses search/replace blocks", () => {
    const response = `I'll fix the typo.

<<<SEARCH
<p>Hello wrold</p>
===
<p>Hello world</p>
>>>`;

    const result = parseAIResponse(response);
    expect(result.type).toBe("search_replace");
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks![0].search).toBe("<p>Hello wrold</p>");
    expect(result.blocks![0].replace).toBe("<p>Hello world</p>");
    expect(result.explanation).toBe("I'll fix the typo.");
  });

  it("parses multiple search/replace blocks", () => {
    const response = `Making two changes.

<<<SEARCH
<p>First error</p>
===
<p>First fix</p>
>>>

<<<SEARCH
<p>Second error</p>
===
<p>Second fix</p>
>>>`;

    const result = parseAIResponse(response);
    expect(result.type).toBe("search_replace");
    expect(result.blocks).toHaveLength(2);
  });

  it("parses full HTML response", () => {
    const response = `Here's the full document rewritten.

\`\`\`html
<h1>New Title</h1>
<p>New content</p>
\`\`\``;

    const result = parseAIResponse(response);
    expect(result.type).toBe("full_html");
    expect(result.fullHtml).toBe("<h1>New Title</h1>\n<p>New content</p>");
    expect(result.explanation).toBe("Here's the full document rewritten.");
  });

  it("returns text_only for plain responses", () => {
    const response = "The document looks good, no changes needed.";
    const result = parseAIResponse(response);
    expect(result.type).toBe("text_only");
    expect(result.explanation).toBe(response);
  });
});

describe("applySearchReplace", () => {
  it("applies a single replacement", () => {
    const original = "<p>Hello wrold</p><p>Another paragraph</p>";
    const result = applySearchReplace(original, [
      { search: "<p>Hello wrold</p>", replace: "<p>Hello world</p>" },
    ]);
    expect(result).toBe("<p>Hello world</p><p>Another paragraph</p>");
  });

  it("applies multiple replacements", () => {
    const original = "<p>First</p><p>Second</p>";
    const result = applySearchReplace(original, [
      { search: "<p>First</p>", replace: "<p>1st</p>" },
      { search: "<p>Second</p>", replace: "<p>2nd</p>" },
    ]);
    expect(result).toBe("<p>1st</p><p>2nd</p>");
  });

  it("handles missing search text gracefully", () => {
    const original = "<p>Hello</p>";
    const result = applySearchReplace(original, [
      { search: "<p>NotFound</p>", replace: "<p>Replaced</p>" },
    ]);
    expect(result).toBe("<p>Hello</p>"); // Unchanged
  });
});
