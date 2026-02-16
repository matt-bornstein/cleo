import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

describe("useOnlineStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("tracks online/offline browser events", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => true,
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });

  it("falls back to online when navigator.onLine is malformed non-boolean", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => undefined,
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it("falls back to online when navigator.onLine getter throws", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get() {
        throw new Error("onLine getter failed");
      },
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it("does not throw when addEventListener throws", () => {
    vi.spyOn(window, "addEventListener").mockImplementation(() => {
      throw new Error("addEventListener failed");
    });

    expect(() => renderHook(() => useOnlineStatus())).not.toThrow();
  });

  it("does not throw when removeEventListener throws during cleanup", () => {
    vi.spyOn(window, "removeEventListener").mockImplementation(() => {
      throw new Error("removeEventListener failed");
    });

    const { unmount } = renderHook(() => useOnlineStatus());
    expect(() => unmount()).not.toThrow();
  });

  it("does not throw when window event listener getters throw", () => {
    const addEventListenerDescriptor = Object.getOwnPropertyDescriptor(
      window,
      "addEventListener",
    );
    const removeEventListenerDescriptor = Object.getOwnPropertyDescriptor(
      window,
      "removeEventListener",
    );

    try {
      Object.defineProperty(window, "addEventListener", {
        configurable: true,
        get() {
          throw new Error("addEventListener getter failed");
        },
      });
      Object.defineProperty(window, "removeEventListener", {
        configurable: true,
        get() {
          throw new Error("removeEventListener getter failed");
        },
      });

      expect(() => renderHook(() => useOnlineStatus())).not.toThrow();
    } finally {
      if (addEventListenerDescriptor) {
        Object.defineProperty(window, "addEventListener", addEventListenerDescriptor);
      }
      if (removeEventListenerDescriptor) {
        Object.defineProperty(window, "removeEventListener", removeEventListenerDescriptor);
      }
    }
  });
});
