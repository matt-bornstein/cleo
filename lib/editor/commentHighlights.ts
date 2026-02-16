import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface CommentAnchor {
  id: string;
  anchorFrom: number;
  anchorTo: number;
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
 * Tiptap extension to render comment anchor highlights as decorations.
 * Uses a shared mutable ref so the extension instance is stable.
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
            const docSize = newState.doc.content.size;

            for (const comment of comments) {
              if (comment.resolved) continue;

              const from = Math.max(0, Math.min(comment.anchorFrom, docSize));
              const to = Math.max(from, Math.min(comment.anchorTo, docSize));

              if (from < to) {
                decorations.push(
                  Decoration.inline(from, to, {
                    class: "comment-highlight",
                    "data-comment-id": comment.id,
                  })
                );
              }
            }

            return DecorationSet.create(newState.doc, decorations);
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
