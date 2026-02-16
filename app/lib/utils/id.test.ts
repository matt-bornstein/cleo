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

  it("falls back to safe id segment when Math.random is malformed", () => {
    vi.stubGlobal("crypto", {} as unknown as Crypto);
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(12345);
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(Number.NaN);

    const id = generateLocalId(123);

    expect(id).toContain("fallback");
    expect(id.startsWith("123-")).toBe(false);

    nowSpy.mockRestore();
    randomSpy.mockRestore();
  });

  it("falls back to timestamp-random id when randomUUID getter throws", () => {
    const cryptoLike = Object.create(null) as { randomUUID: unknown };
    Object.defineProperty(cryptoLike, "randomUUID", {
      get() {
        throw new Error("randomUUID getter failed");
      },
    });
    vi.stubGlobal("crypto", cryptoLike as unknown as Crypto);
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(12345);
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    expect(() => generateLocalId("local")).not.toThrow();
    expect(generateLocalId("local")).toMatch(/^local-/);

    nowSpy.mockRestore();
    randomSpy.mockRestore();
  });

  it("falls back to safe random segment when Math.random throws", () => {
    vi.stubGlobal("crypto", {} as unknown as Crypto);
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(12345);
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random failed");
    });

    const id = generateLocalId("local");

    expect(id).toContain("fallback");
    nowSpy.mockRestore();
    randomSpy.mockRestore();
  });

  it("falls back to zero timestamp segment when Date.now throws", () => {
    vi.stubGlobal("crypto", {} as unknown as Crypto);
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Date.now failed");
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    const id = generateLocalId("local");

    expect(id).toMatch(/^local-0-/);
    nowSpy.mockRestore();
    randomSpy.mockRestore();
  });
});
