import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface RemoteCursor {
  visitorId: string;
  userName: string;
  color: string;
  cursor?: number;
  selection?: { from: number; to: number };
}

const remoteCursorsPluginKey = new PluginKey("remoteCursors");

/**
 * Shared mutable ref for cursor data. The plugin reads from this
 * on every transaction so the extension config doesn't need to change.
 */
export const remoteCursorsState = {
  cursors: [] as RemoteCursor[],
};

/**
 * Tiptap extension to render remote collaborator cursors and selections
 * as ProseMirror decorations. Uses a shared mutable ref for cursor data
 * so the extension instance is stable and doesn't need to be recreated.
 */
export const RemoteCursorsExtension = Extension.create({
  name: "remoteCursors",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: remoteCursorsPluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(_tr, _old, _oldState, newState) {
            const cursors = remoteCursorsState.cursors;
            const decorations: Decoration[] = [];

            for (const cursor of cursors) {
              const docSize = newState.doc.content.size;

              // Selection highlight
              if (cursor.selection) {
                const from = Math.min(cursor.selection.from, docSize);
                const to = Math.min(cursor.selection.to, docSize);
                if (from < to && from >= 0) {
                  decorations.push(
                    Decoration.inline(from, to, {
                      class: "remote-selection",
                      style: `background-color: ${cursor.color}60;`,
                    })
                  );
                }
              }

              // Cursor line
              if (cursor.cursor !== undefined && cursor.cursor !== null) {
                const pos = Math.min(Math.max(cursor.cursor, 0), docSize);
                decorations.push(
                  Decoration.widget(pos, () => {
                    const cursorEl = document.createElement("span");
                    cursorEl.className = "remote-cursor";
                    cursorEl.style.borderLeft = `2px solid ${cursor.color}`;
                    cursorEl.style.marginLeft = "-1px";
                    cursorEl.style.position = "relative";
                    cursorEl.style.display = "inline";
                    cursorEl.style.height = "1.2em";

                    const label = document.createElement("span");
                    label.className = "remote-cursor-label";
                    label.textContent = cursor.userName;
                    label.style.position = "absolute";
                    label.style.top = "-1.4em";
                    label.style.left = "-1px";
                    label.style.fontSize = "10px";
                    label.style.fontWeight = "600";
                    label.style.color = "white";
                    label.style.backgroundColor = cursor.color;
                    label.style.padding = "1px 4px";
                    label.style.borderRadius = "3px";
                    label.style.whiteSpace = "nowrap";
                    label.style.lineHeight = "1.2";
                    label.style.pointerEvents = "none";

                    cursorEl.appendChild(label);
                    return cursorEl;
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
