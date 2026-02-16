import { describe, it, expect } from "vitest";
import { computeHtmlPatch, applyHtmlPatch } from "../../convex/lib/diffing";

describe("computeHtmlPatch", () => {
  it("computes a patch for simple text change", () => {
    const old = "<p>Hello world</p>";
    const newHtml = "<p>Hello there</p>";
    const patch = computeHtmlPatch(old, newHtml);
    expect(patch).toBeTruthy();
    expect(patch.length).toBeGreaterThan(0);
  });

  it("returns empty-ish patch for identical content", () => {
    const html = "<p>Same content</p>";
    const patch = computeHtmlPatch(html, html);
    // diff-match-patch returns empty patch for identical strings
    expect(patch).toBe("");
  });

  it("computes a patch for adding content", () => {
    const old = "<p>First paragraph</p>";
    const newHtml = "<p>First paragraph</p>\n<p>Second paragraph</p>";
    const patch = computeHtmlPatch(old, newHtml);
    expect(patch).toContain("Second paragraph");
  });
});

describe("applyHtmlPatch", () => {
  it("applies a patch correctly", () => {
    const old = "<p>Hello world</p>";
    const newHtml = "<p>Hello there</p>";
    const patch = computeHtmlPatch(old, newHtml);
    const { result, success } = applyHtmlPatch(old, patch);
    expect(success).toBe(true);
    expect(result).toBe(newHtml);
  });

  it("roundtrips through compute + apply", () => {
    const old = "<h1>Title</h1>\n<p>Some content here.</p>\n<ul>\n<li>Item 1</li>\n<li>Item 2</li>\n</ul>";
    const newHtml = "<h1>New Title</h1>\n<p>Updated content here.</p>\n<ul>\n<li>Item 1</li>\n<li>Item 2</li>\n<li>Item 3</li>\n</ul>";
    const patch = computeHtmlPatch(old, newHtml);
    const { result, success } = applyHtmlPatch(old, patch);
    expect(success).toBe(true);
    expect(result).toBe(newHtml);
  });

  it("handles empty patch (no changes)", () => {
    const html = "<p>No changes</p>";
    const { result, success } = applyHtmlPatch(html, "");
    expect(success).toBe(true);
    expect(result).toBe(html);
  });
});
