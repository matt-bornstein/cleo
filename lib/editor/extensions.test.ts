import { describe, expect, it } from "vitest";
import { editorExtensions } from "./extensions";

describe("editorExtensions", () => {
  it("enables aspect-ratio-preserving image resize handles", () => {
    const imageExtension = editorExtensions.find(
      (extension) => extension.name === "image"
    );

    expect(imageExtension?.options.resize).toEqual({
      enabled: true,
      directions: ["top-left", "top-right", "bottom-left", "bottom-right"],
      minWidth: 80,
      minHeight: 80,
      alwaysPreserveAspectRatio: true,
    });
  });
});
