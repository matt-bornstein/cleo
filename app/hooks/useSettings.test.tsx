import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";

import { useSettings } from "@/hooks/useSettings";
import * as aiModels from "@/lib/ai/models";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";

const getSettingsMock = vi.fn();
vi.mock("@/lib/settings/store", () => ({
  getSettings: () => getSettingsMock(),
}));

describe("useSettings", () => {
  beforeEach(() => {
    getSettingsMock.mockReset();
  });

  it("returns settings from store and refreshes on demand", () => {
    getSettingsMock
      .mockReturnValueOnce({
        theme: "dark",
        defaultModel: "gpt-4o",
        editorFontSize: 16,
        editorLineSpacing: 1.6,
        userEmail: "owner@example.com",
      })
      .mockReturnValueOnce({
        theme: "light",
        defaultModel: "gpt-4.1",
        editorFontSize: 18,
        editorLineSpacing: 1.8,
        userEmail: "owner@example.com",
      });

    const { result } = renderHook(() => useSettings());
    expect(result.current.settings).toEqual(
      expect.objectContaining({
        theme: "dark",
        defaultModel: "gpt-4o",
      }),
    );

    act(() => {
      result.current.refreshSettings();
    });

    expect(result.current.settings).toEqual(
      expect.objectContaining({
        theme: "light",
        defaultModel: "gpt-4.1",
      }),
    );
  });

  it("falls back safely when settings store throws", () => {
    getSettingsMock.mockImplementation(() => {
      throw new Error("settings unavailable");
    });

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings).toEqual({
      theme: "system",
      defaultModel: "gpt-4o",
      editorFontSize: 16,
      editorLineSpacing: 1.6,
      userEmail: DEFAULT_LOCAL_USER_EMAIL,
    });
  });

  it("normalizes malformed settings payloads and getter traps", () => {
    const settingsWithThrowingGetters = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(settingsWithThrowingGetters, "theme", {
      get() {
        throw new Error("theme getter failed");
      },
    });
    Object.defineProperty(settingsWithThrowingGetters, "defaultModel", {
      value: "  ",
    });
    Object.defineProperty(settingsWithThrowingGetters, "editorFontSize", {
      value: Number.NaN,
    });
    Object.defineProperty(settingsWithThrowingGetters, "editorLineSpacing", {
      value: -1,
    });
    Object.defineProperty(settingsWithThrowingGetters, "userEmail", {
      get() {
        throw new Error("userEmail getter failed");
      },
    });
    getSettingsMock.mockReturnValue(settingsWithThrowingGetters);

    const { result } = renderHook(() => useSettings());
    expect(result.current.settings).toEqual({
      theme: "system",
      defaultModel: "gpt-4o",
      editorFontSize: 16,
      editorLineSpacing: 1.6,
      userEmail: DEFAULT_LOCAL_USER_EMAIL,
    });
  });

  it("falls back to safe default model for malformed model ids and lookup failures", () => {
    getSettingsMock.mockReturnValue({
      theme: "dark",
      defaultModel: "bad\nmodel",
      editorFontSize: 16,
      editorLineSpacing: 1.6,
      userEmail: "owner@example.com",
    });

    const { result, rerender } = renderHook(() => useSettings());
    expect(result.current.settings.defaultModel).toBe("gpt-4o");

    getSettingsMock.mockReturnValue({
      theme: "dark",
      defaultModel: "gpt-4.1",
      editorFontSize: 16,
      editorLineSpacing: 1.6,
      userEmail: "owner@example.com",
    });
    vi.spyOn(aiModels, "getModelConfig").mockImplementation(() => {
      throw new Error("model lookup failed");
    });

    act(() => {
      result.current.refreshSettings();
    });
    rerender();

    expect(result.current.settings.defaultModel).toBe("gpt-4o");
  });
});
