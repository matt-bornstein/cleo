import { act, renderHook } from "@testing-library/react";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

describe("useOnlineStatus", () => {
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
});
