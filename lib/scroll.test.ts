import { describe, it, expect } from "vitest";
import { isScrolledToBottom, SCROLL_BOTTOM_THRESHOLD } from "./scroll";

describe("isScrolledToBottom", () => {
  it("is true when scrolled all the way down", () => {
    expect(
      isScrolledToBottom({ scrollTop: 600, scrollHeight: 1000, clientHeight: 400 })
    ).toBe(true);
  });

  it("is false when scrolled up", () => {
    expect(
      isScrolledToBottom({ scrollTop: 200, scrollHeight: 1000, clientHeight: 400 })
    ).toBe(false);
  });

  it("is false one pixel above the threshold", () => {
    expect(
      isScrolledToBottom({
        scrollTop: 600 - SCROLL_BOTTOM_THRESHOLD - 1,
        scrollHeight: 1000,
        clientHeight: 400,
      })
    ).toBe(false);
  });

  it("tolerates sub-pixel rounding within the threshold", () => {
    expect(
      isScrolledToBottom({ scrollTop: 599.6, scrollHeight: 1000, clientHeight: 400 })
    ).toBe(true);
  });

  it("is true when the content is shorter than the viewport", () => {
    expect(
      isScrolledToBottom({ scrollTop: 0, scrollHeight: 120, clientHeight: 400 })
    ).toBe(true);
  });

  it("honors a custom threshold", () => {
    const metrics = { scrollTop: 550, scrollHeight: 1000, clientHeight: 400 };
    expect(isScrolledToBottom(metrics, 50)).toBe(true);
    expect(isScrolledToBottom(metrics, 10)).toBe(false);
  });
});
