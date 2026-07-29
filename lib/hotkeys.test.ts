import { describe, it, expect } from "vitest";
import {
  focusToggleHotkeyLabel,
  isFocusToggleHotkey,
  isMacLike,
  nextFocusToggleTarget,
  type HotkeyEvent,
} from "./hotkeys";

function event(overrides: Partial<HotkeyEvent> = {}): HotkeyEvent {
  return {
    key: "k",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  };
}

describe("isMacLike", () => {
  it("detects Apple platforms", () => {
    expect(isMacLike("MacIntel")).toBe(true);
    expect(isMacLike("macOS")).toBe(true);
    expect(isMacLike("iPhone")).toBe(true);
    expect(isMacLike("iPad")).toBe(true);
  });

  it("rejects other platforms", () => {
    expect(isMacLike("Win32")).toBe(false);
    expect(isMacLike("Windows")).toBe(false);
    expect(isMacLike("Linux x86_64")).toBe(false);
    expect(isMacLike("")).toBe(false);
  });
});

describe("isFocusToggleHotkey", () => {
  it("matches Cmd+K on mac", () => {
    expect(isFocusToggleHotkey(event({ metaKey: true }), true)).toBe(true);
  });

  it("matches Ctrl+K off mac", () => {
    expect(isFocusToggleHotkey(event({ ctrlKey: true }), false)).toBe(true);
  });

  it("ignores the non-platform modifier", () => {
    expect(isFocusToggleHotkey(event({ ctrlKey: true }), true)).toBe(false);
    expect(isFocusToggleHotkey(event({ metaKey: true }), false)).toBe(false);
  });

  it("ignores a bare k", () => {
    expect(isFocusToggleHotkey(event(), true)).toBe(false);
    expect(isFocusToggleHotkey(event(), false)).toBe(false);
  });

  it("ignores other keys", () => {
    expect(isFocusToggleHotkey(event({ key: "j", metaKey: true }), true)).toBe(false);
    expect(isFocusToggleHotkey(event({ key: "Enter", ctrlKey: true }), false)).toBe(false);
  });

  it("accepts an uppercase key value", () => {
    expect(isFocusToggleHotkey(event({ key: "K", metaKey: true }), true)).toBe(true);
  });

  it("ignores extra modifiers so it does not shadow other shortcuts", () => {
    expect(isFocusToggleHotkey(event({ metaKey: true, shiftKey: true }), true)).toBe(false);
    expect(isFocusToggleHotkey(event({ metaKey: true, altKey: true }), true)).toBe(false);
    expect(isFocusToggleHotkey(event({ ctrlKey: true, shiftKey: true }), false)).toBe(false);
  });

  it("rejects both platform modifiers held together", () => {
    expect(isFocusToggleHotkey(event({ metaKey: true, ctrlKey: true }), true)).toBe(false);
    expect(isFocusToggleHotkey(event({ metaKey: true, ctrlKey: true }), false)).toBe(false);
  });
});

describe("focusToggleHotkeyLabel", () => {
  it("uses the platform modifier symbol", () => {
    expect(focusToggleHotkeyLabel(true)).toBe("⌘K");
    expect(focusToggleHotkeyLabel(false)).toBe("Ctrl+K");
  });
});

describe("nextFocusToggleTarget", () => {
  it("moves to chat when focus is in the editor", () => {
    expect(
      nextFocusToggleTarget({ hasVisibleChatPanel: true, isFocusInChatPanel: false })
    ).toBe("chat");
  });

  it("moves back to the editor when focus is in the chat panel", () => {
    expect(
      nextFocusToggleTarget({ hasVisibleChatPanel: true, isFocusInChatPanel: true })
    ).toBe("editor");
  });

  it("reveals the panel first when it is collapsed", () => {
    expect(
      nextFocusToggleTarget({ hasVisibleChatPanel: false, isFocusInChatPanel: false })
    ).toBe("reveal-chat");
  });
});
