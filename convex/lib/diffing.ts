/**
 * HTML-level diffing using diff-match-patch.
 * Computes a compact patch string between two HTML documents.
 */
import DiffMatchPatch from "diff-match-patch";

const dmp = new DiffMatchPatch();

/**
 * Compute a patch string between two HTML strings.
 * Returns a serialized patch that can be stored in the database.
 */
export function computeHtmlPatch(oldHtml: string, newHtml: string): string {
  const patches = dmp.patch_make(oldHtml, newHtml);
  return dmp.patch_toText(patches);
}

/**
 * Apply a patch string to an HTML string.
 * Returns the patched HTML and a boolean indicating if all patches applied cleanly.
 */
export function applyHtmlPatch(
  html: string,
  patchText: string
): { result: string; success: boolean } {
  const patches = dmp.patch_fromText(patchText);
  const [result, results] = dmp.patch_apply(patches, html);
  const allApplied = results.every((r) => r);
  return { result, success: allApplied };
}
