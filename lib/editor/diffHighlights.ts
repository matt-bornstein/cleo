import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface DiffEntry {
  addedText: string;
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

export function addDiffHighlight(addedText: string) {
  if (!addedText.trim()) return;
  diffHighlightsState.diffs.push({
    addedText,
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

            const decorations: Decoration[] = [];
            const doc = newState.doc;
            const docSize = doc.content.size;

            for (const diff of diffs) {
              const fragments = extractTextFragments(diff.addedText);
              for (const fragment of fragments) {
                const found = findTextInDoc(doc, fragment);
                if (found && found.from >= 0 && found.to <= docSize && found.from < found.to) {
                  decorations.push(
                    Decoration.inline(found.from, found.to, {
                      class: "ai-diff-added",
                    })
                  );
                }
              }
            }

            return DecorationSet.create(doc, decorations);
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
