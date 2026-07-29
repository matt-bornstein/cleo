/**
 * Cmd/Ctrl+K toggles focus between the document editor and the AI chat input.
 *
 * The logic lives here (free of DOM/React) so it can be unit tested; the
 * browser wiring is in `hooks/useFocusToggleHotkey`.
 */

/** Matches Tailwind's `lg` breakpoint, where the editor and AI panel sit side by side. */
export const DESKTOP_MEDIA_QUERY = "(min-width: 64rem)";

/** Marks the AI panel root so the hotkey can tell whether focus is inside it. */
export const CHAT_PANEL_ATTR = "data-chat-panel";

/** Marks the AI chat prompt field so the hotkey can focus it. */
export const CHAT_INPUT_ATTR = "data-chat-input";

export interface HotkeyEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export function isMacLike(platform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Cmd+K on macOS, Ctrl+K everywhere else. */
export function isFocusToggleHotkey(event: HotkeyEvent, isMac: boolean): boolean {
  if (event.key.toLowerCase() !== "k") return false;
  if (event.altKey || event.shiftKey) return false;
  return isMac
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
}

export function focusToggleHotkeyLabel(isMac: boolean): string {
  return isMac ? "⌘K" : "Ctrl+K";
}

export type FocusToggleTarget = "editor" | "chat" | "reveal-chat";

/**
 * Focus goes to the chat input unless it is already there, in which case it
 * returns to the editor. When the AI panel is collapsed it has to be revealed
 * before it can be focused.
 */
export function nextFocusToggleTarget({
  hasVisibleChatPanel,
  isFocusInChatPanel,
}: {
  hasVisibleChatPanel: boolean;
  isFocusInChatPanel: boolean;
}): FocusToggleTarget {
  if (!hasVisibleChatPanel) return "reveal-chat";
  return isFocusInChatPanel ? "editor" : "chat";
}
