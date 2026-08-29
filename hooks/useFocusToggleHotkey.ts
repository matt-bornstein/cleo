"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  CHAT_INPUT_ATTR,
  CHAT_PANEL_ATTR,
  DESKTOP_MEDIA_QUERY,
  focusToggleHotkeyLabel,
  isFocusToggleHotkey,
  isMacLike,
  nextFocusToggleTarget,
} from "@/lib/hotkeys";

function detectPlatform(): string {
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData;
  return uaData?.platform || navigator.platform || navigator.userAgent;
}

/** `display: none` ancestors zero out both, while `position: fixed` only zeroes `offsetParent`. */
function isRendered(element: HTMLElement): boolean {
  return element.offsetParent !== null || element.getClientRects().length > 0;
}

function findChatPanel(): HTMLElement | null {
  const panels = document.querySelectorAll<HTMLElement>(`[${CHAT_PANEL_ATTR}]`);
  return Array.from(panels).find(isRendered) ?? null;
}

function focusChatInput(panel: HTMLElement): boolean {
  const input = panel.querySelector<HTMLTextAreaElement>(`[${CHAT_INPUT_ATTR}]`);
  if (!input || input.disabled) return false;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  return true;
}

/** Radix keeps modal content mounted while it animates out, so check the open state too. */
function hasOpenModal(): boolean {
  return (
    document.querySelector(
      '[data-slot="dialog-content"][data-state="open"], [data-slot="alert-dialog-content"][data-state="open"]'
    ) !== null
  );
}

interface UseFocusToggleHotkeyOptions {
  focusEditor: () => boolean;
  /** Called when the AI panel is collapsed and needs to be shown before focusing. */
  revealChatPanel?: () => void;
}

/**
 * Registers the Cmd/Ctrl+K shortcut that moves focus between the document
 * editor and the AI chat input. Only active in the side-by-side desktop layout.
 */
export function useFocusToggleHotkey({
  focusEditor,
  revealChatPanel,
}: UseFocusToggleHotkeyOptions) {
  useEffect(() => {
    // Focus the panel once React has rendered it; retry across a few frames
    // because the reveal is driven by a state update.
    const focusChatWhenRendered = (framesLeft: number) => {
      requestAnimationFrame(() => {
        const panel = findChatPanel();
        if (panel && focusChatInput(panel)) return;
        if (framesLeft > 1) focusChatWhenRendered(framesLeft - 1);
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isFocusToggleHotkey(event, isMacLike(detectPlatform()))) return;
      if (!window.matchMedia(DESKTOP_MEDIA_QUERY).matches) return;
      if (hasOpenModal()) return;

      // Claim the shortcut from the browser (Ctrl+K focuses the address bar).
      event.preventDefault();

      const panel = findChatPanel();
      const target = nextFocusToggleTarget({
        hasVisibleChatPanel: panel !== null,
        isFocusInChatPanel:
          panel !== null &&
          document.activeElement !== null &&
          panel.contains(document.activeElement),
      });

      if (target === "editor") {
        focusEditor();
      } else if (target === "chat" && panel) {
        focusChatInput(panel);
      } else {
        revealChatPanel?.();
        focusChatWhenRendered(3);
      }
    };

    // Capture phase so the shortcut works no matter which field has focus.
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [focusEditor, revealChatPanel]);
}

const neverChanges = () => () => {};

/** Platform-correct shortcut label. The platform is unknown until we reach the browser. */
export function useFocusToggleHotkeyLabel(): string {
  return useSyncExternalStore(
    neverChanges,
    () => focusToggleHotkeyLabel(isMacLike(detectPlatform())),
    () => focusToggleHotkeyLabel(false)
  );
}
