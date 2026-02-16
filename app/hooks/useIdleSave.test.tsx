import { renderHook } from "@testing-library/react";
import { vi } from "vitest";

import { useIdleSave } from "@/hooks/useIdleSave";

describe("useIdleSave", () => {
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
});
