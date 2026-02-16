import { generateLocalId } from "@/lib/utils/id";
import { vi } from "vitest";

describe("generateLocalId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses crypto.randomUUID when available", () => {
    const randomUUID = vi.fn().mockReturnValue("uuid-123");
    vi.stubGlobal("crypto", { randomUUID } as unknown as Crypto);

    expect(generateLocalId()).toBe("uuid-123");
    expect(generateLocalId("visitor")).toBe("visitor-uuid-123");
    expect(randomUUID).toHaveBeenCalledTimes(2);
  });

  it("falls back to timestamp-random id when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {} as unknown as Crypto);
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(12345);
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    const id = generateLocalId("local");

    expect(id).toMatch(/^local-/);
    expect(id.length).toBeGreaterThan("local-".length);
    nowSpy.mockRestore();
    randomSpy.mockRestore();
  });
});
