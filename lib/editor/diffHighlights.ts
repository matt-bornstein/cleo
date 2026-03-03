import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface DiffEntry {
  addedText: string;
  deletedText?: string;
  contextAfter?: string; // HTML after deletion point — used to position widget when addedText is empty
  timestamp: number;
}

const diffHighlightsPluginKey = new PluginKey("diffHighlights");

/**
 * Shared mutable ref for diff data. The plugin reads from this
 * on every transaction so the extension config doesn't need to change.
 */
export const diffHighlightsState = {
  diffs: [] as DiffEntry[],
};

export function clearDiffHighlights() {
  diffHighlightsState.diffs = [];
}

/**
 * Replace local diff state with entries from the database's highlightData array.
 * Used to sync diff decorations across all collaborators.
 */
export function setDiffHighlightsFromData(highlightData: string[]) {
  const entries: DiffEntry[] = [];
  for (const fragment of highlightData) {
    try {
      const parsed = JSON.parse(fragment);
      if (parsed.replace || parsed.search) {
        entries.push({
          addedText: parsed.replace || "",
          deletedText: parsed.search,
          contextAfter: parsed.contextAfter,
          timestamp: Date.now(),
        });
      }
    } catch {
      if (fragment.trim()) {
        entries.push({ addedText: fragment, timestamp: Date.now() });
      }
    }
  }
  diffHighlightsState.diffs = entries;
}

export function addDiffHighlight(addedText: string, deletedText?: string, contextAfter?: string) {
  if (!addedText.trim() && !deletedText?.trim()) return;
  diffHighlightsState.diffs.push({
    addedText,
    deletedText,
    contextAfter,
    timestamp: Date.now(),
  });
}

function findTextInDoc(
  doc: ProseMirrorNode,
  searchText: string
): { from: number; to: number } | null {
  if (!searchText) return null;

  const fullText = doc.textContent;
  const idx = fullText.indexOf(searchText);
  if (idx === -1) return null;

  let charsSeen = 0;
  let startPos: number | null = null;
  let endPos: number | null = null;

  doc.descendants((node, pos) => {
    if (endPos !== null) return false;

    if (node.isText && node.text) {
      const nodeStart = charsSeen;
      const nodeEnd = charsSeen + node.text.length;

      if (startPos === null && nodeEnd > idx) {
        const offsetInNode = idx - nodeStart;
        startPos = pos + offsetInNode;
      }

      if (startPos !== null && nodeEnd >= idx + searchText.length) {
        const offsetInNode = idx + searchText.length - nodeStart;
        endPos = pos + offsetInNode;
        return false;
      }

      charsSeen += node.text.length;
    }

    return true;
  });

  if (startPos !== null && endPos !== null) {
    return { from: startPos, to: endPos };
  }
  return null;
}

/**
 * Strip HTML tags to extract individual text segments for searching
 * in the ProseMirror document. Returns an array of non-empty text
 * fragments (one per block element) so we can highlight each
 * fragment independently.
 */
function extractTextFragments(html: string): string[] {
  const segments = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|h[1-6]|li|div|blockquote|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  return segments
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Extract plain text from HTML for display in the deleted-text widget.
 */
function extractPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|h[1-6]|li|div|blockquote|tr)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Wrap bare text segments in HTML with <span class="ai-diff-deleted-text">
 * so only the actual text gets a red background highlight, not the container.
 */
function wrapTextNodes(html: string): string {
  // Process text that's outside of tags — wrap each text run in a highlight span
  return html.replace(/>([^<]+)</g, (_, text) => {
    if (!text.trim()) return `>${text}<`;
    return `><span class="ai-diff-deleted-text">${text}</span><`;
  }).replace(/^([^<]+)/, (text) => {
    if (!text.trim()) return text;
    return `<span class="ai-diff-deleted-text">${text}</span>`;
  });
}

export const DiffHighlightsExtension = Extension.create({
  name: "diffHighlights",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: diffHighlightsPluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(_tr, _old, _oldState, newState) {
            const diffs = diffHighlightsState.diffs;
            if (diffs.length === 0) return DecorationSet.empty;

            try {
              const decorations: Decoration[] = [];
              const doc = newState.doc;
              const docSize = doc.content.size;

              for (let i = 0; i < diffs.length; i++) {
                const diff = diffs[i];
                const fragments = extractTextFragments(diff.addedText);
                let firstAddedPos: number | null = null;

                for (const fragment of fragments) {
                  const found = findTextInDoc(doc, fragment);
                  if (found && found.from >= 0 && found.to <= docSize && found.from < found.to) {
                    decorations.push(
                      Decoration.inline(found.from, found.to, {
                        class: "ai-diff-added",
                      })
                    );
                    if (firstAddedPos === null) {
                      firstAddedPos = found.from;
                    }
                  }
                }

                // For pure deletions (no added text), find position using contextAfter
                if (diff.deletedText && firstAddedPos === null && diff.contextAfter) {
                  const contextFragments = extractTextFragments(diff.contextAfter);
                  if (contextFragments.length > 0) {
                    const found = findTextInDoc(doc, contextFragments[0]);
                    if (found && found.from >= 0 && found.from <= docSize) {
                      firstAddedPos = found.from;
                    }
                  }
                }

                if (diff.deletedText && firstAddedPos !== null) {
                  try {
                    const plainDeleted = extractPlainText(diff.deletedText);
                    if (plainDeleted) {
                      const isBlock = /^<(?:p|h[1-6]|li|ul|ol|blockquote|div|pre|table|tr)\b/i.test(diff.deletedText!);
                      decorations.push(
                        Decoration.widget(firstAddedPos, () => {
                          const wrapper = document.createElement(isBlock ? "div" : "span");
                          wrapper.className = "ai-diff-deleted";
                          // Render with original HTML structure, wrapping text nodes
                          // in spans so only the text itself gets the red background
                          wrapper.innerHTML = wrapTextNodes(diff.deletedText!);
                          return wrapper;
                        }, { side: -1, key: `deleted-${diff.timestamp}` })
                      );
                    }
                  } catch (e) {
                    console.warn("[DiffHighlights] Failed to create deleted-text widget:", e);
                  }
                }
              }

              // Sort by position — required by DecorationSet.create
              decorations.sort((a, b) => a.from - b.from);
              return DecorationSet.create(doc, decorations);
            } catch (e) {
              console.error("[DiffHighlights] apply error:", e);
              return DecorationSet.empty;
            }
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
