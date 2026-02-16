import { getModelConfig, isSupportedModel } from "@/lib/ai/models";

describe("ai model registry", () => {
  it("recognizes supported model ids", () => {
    expect(isSupportedModel("gpt-4o")).toBe(true);
    expect(isSupportedModel("  gpt-4o  ")).toBe(true);
    expect(isSupportedModel("claude-sonnet-4-20250514")).toBe(true);
    expect(isSupportedModel("non-existent-model")).toBe(false);
    expect(isSupportedModel(123)).toBe(false);
    expect(isSupportedModel("gpt-4o\u0000")).toBe(false);
  });

  it("falls back to first model config when unknown id requested", () => {
    const fallback = getModelConfig("unknown-model-id");
    expect(fallback.id).toBe("gpt-4o");

    const fromMalformed = getModelConfig(123);
    expect(fromMalformed.id).toBe("gpt-4o");
  });
});
