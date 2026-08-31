/** Pixel tolerance so sub-pixel layout rounding still counts as "at the bottom". */
export const SCROLL_BOTTOM_THRESHOLD = 8;

interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export function isScrolledToBottom(
  { scrollTop, scrollHeight, clientHeight }: ScrollMetrics,
  threshold: number = SCROLL_BOTTOM_THRESHOLD
): boolean {
  return scrollHeight - clientHeight - scrollTop <= threshold;
}
