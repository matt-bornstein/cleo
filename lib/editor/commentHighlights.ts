import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface CommentAnchor {
  id: string;
  anchorFrom: number;
  anchorTo: number;
  anchorText: string;
  resolved: boolean;
}

const commentHighlightsPluginKey = new PluginKey("commentHighlights");

/**
 * Shared mutable ref for comment data. The plugin reads from this
 * on every transaction so the extension config doesn't need to change.
 */
export const commentHighlightsState = {
  comments: [] as CommentAnchor[],
};

/**
 * Search for anchorText in the document and return the position range.
 * Returns null if not found.
 */
function findTextInDoc(
  doc: ProseMirrorNode,
  searchText: string
): { from: number; to: number } | null {
  if (!searchText) return null;

  const fullText = doc.textContent;
  const idx = fullText.indexOf(searchText);
  if (idx === -1) return null;

  // Convert text offset to ProseMirror position.
  // Walk the document nodes to map character offset → position.
  let charsSeen = 0;
  let startPos: number | null = null;
  let endPos: number | null = null;

  doc.descendants((node, pos) => {
    if (endPos !== null) return false; // Already found, stop

    if (node.isText && node.text) {
      const nodeStart = charsSeen;
      const nodeEnd = charsSeen + node.text.length;

      // Does this node contain the start of our match?
      if (startPos === null && nodeEnd > idx) {
        const offsetInNode = idx - nodeStart;
        startPos = pos + offsetInNode;
      }

      // Does this node contain the end of our match?
      if (startPos !== null && nodeEnd >= idx + searchText.length) {
        const offsetInNode = idx + searchText.length - nodeStart;
        endPos = pos + offsetInNode;
        return false; // Stop traversal
      }

      charsSeen += node.text.length;
    }

    return true; // Continue traversal
  });

  if (startPos !== null && endPos !== null) {
    return { from: startPos, to: endPos };
  }
  return null;
}

/**
 * Tiptap extension to render comment anchor highlights as decorations.
 * Implements anchor remapping: if the stored positions don't match the
 * anchorText, searches the document to find where the text moved.
 */
export const CommentHighlightsExtension = Extension.create({
  name: "commentHighlights",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: commentHighlightsPluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(_tr, _old, _oldState, newState) {
            const comments = commentHighlightsState.comments;
            const decorations: Decoration[] = [];
            const doc = newState.doc;
            const docSize = doc.content.size;

            for (const comment of comments) {
              if (comment.resolved) continue;
              if (!comment.anchorText) continue;

              let from = Math.max(0, Math.min(comment.anchorFrom, docSize));
              let to = Math.max(from, Math.min(comment.anchorTo, docSize));

              // Verify the text at the stored position matches anchorText
              let textAtPosition = "";
              try {
                textAtPosition = doc.textBetween(from, to, " ");
              } catch {
                // Position out of range
              }

              if (textAtPosition !== comment.anchorText) {
                // Text drifted — search for it in the document
                const found = findTextInDoc(doc, comment.anchorText);
                if (found) {
                  from = found.from;
                  to = found.to;
                } else {
                  // Text was deleted — skip this comment (orphaned)
                  continue;
                }
              }

              if (from < to && from >= 0 && to <= docSize) {
                decorations.push(
                  Decoration.inline(from, to, {
                    class: "comment-highlight",
                    "data-comment-id": comment.id,
                  })
                );
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
