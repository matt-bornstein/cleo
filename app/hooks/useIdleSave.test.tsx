import { renderHook } from "@testing-library/react";
import { vi } from "vitest";

import { useIdleSave } from "@/hooks/useIdleSave";

describe("useIdleSave", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debounces onIdle callbacks", () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const { result } = renderHook(() => useIdleSave({ delayMs: 5000, onIdle }));

    result.current.scheduleIdleSave();
    result.current.scheduleIdleSave();
    result.current.scheduleIdleSave();

    vi.advanceTimersByTime(4999);
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("falls back to default delay for malformed delay inputs", () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const { result } = renderHook(() =>
      useIdleSave({ delayMs: Number.NaN, onIdle }),
    );

    result.current.scheduleIdleSave();
    vi.advanceTimersByTime(4999);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("does not throw when onIdle callback is malformed non-function", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useIdleSave({ delayMs: 10, onIdle: 123 }),
    );

    expect(() => {
      result.current.scheduleIdleSave();
      vi.advanceTimersByTime(10);
    }).not.toThrow();

    vi.useRealTimers();
  });

  it("does not throw when setTimeout throws at runtime", () => {
    vi.spyOn(globalThis, "setTimeout").mockImplementation(() => {
      throw new Error("setTimeout failed");
    });
    const onIdle = vi.fn();
    const { result } = renderHook(() => useIdleSave({ delayMs: 10, onIdle }));

    expect(() => {
      result.current.scheduleIdleSave();
    }).not.toThrow();
    expect(onIdle).not.toHaveBeenCalled();
  });

  it("does not throw when clearTimeout throws at runtime", () => {
    const setTimeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockReturnValue(123 as unknown as ReturnType<typeof setTimeout>);
    vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => {
      throw new Error("clearTimeout failed");
    });
    const onIdle = vi.fn();
    const { result } = renderHook(() => useIdleSave({ delayMs: 10, onIdle }));

    expect(() => {
      result.current.scheduleIdleSave();
      result.current.scheduleIdleSave();
    }).not.toThrow();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
  });
});
