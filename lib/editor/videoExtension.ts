import { Node, mergeAttributes } from "@tiptap/core";

export interface VideoOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: { src: string }) => ReturnType;
    };
  }
}

export const Video = Node.create<VideoOptions>({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      controls: {
        default: true,
      },
      width: {
        default: "100%",
      },
      uploading: {
        default: false,
      },
      uploadId: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "video" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const wrapper = document.createElement("div");
      wrapper.contentEditable = "false";
      wrapper.style.margin = "0.75em 0";

      if (node.attrs.uploading) {
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.gap = "8px";
        wrapper.style.padding = "12px 16px";
        wrapper.style.borderRadius = "var(--radius)";
        wrapper.style.border = "1px dashed var(--border)";
        wrapper.style.color = "var(--muted-foreground)";
        wrapper.style.fontSize = "14px";

        const spinner = document.createElement("div");
        spinner.style.width = "16px";
        spinner.style.height = "16px";
        spinner.style.border = "2px solid var(--border)";
        spinner.style.borderTopColor = "var(--foreground)";
        spinner.style.borderRadius = "50%";
        spinner.style.animation = "spin 0.8s linear infinite";
        wrapper.appendChild(spinner);

        const label = document.createElement("span");
        label.textContent = "Uploading video…";
        wrapper.appendChild(label);

        return { dom: wrapper, contentDOM: null, stopEvent: () => true };
      }

      if (!node.attrs.src) {
        return { dom: wrapper, contentDOM: null, stopEvent: () => true };
      }

      const video = document.createElement("video");
      video.setAttribute("controls", "true");
      video.setAttribute("preload", "metadata");
      video.setAttribute("playsinline", "true");
      video.style.width = node.attrs.width ?? "100%";
      video.style.maxWidth = "100%";
      video.style.borderRadius = "var(--radius)";
      video.style.display = "block";
      video.draggable = false;
      video.src = node.attrs.src;

      wrapper.appendChild(video);

      return {
        dom: wrapper,
        contentDOM: null,
        stopEvent: () => true,
        update: (updatedNode) => {
          if (updatedNode.type.name !== "video") return false;
          if (updatedNode.attrs.uploading) return false;
          video.src = updatedNode.attrs.src;
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      setVideo:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});
