import { AI_MODELS, getModelConfig, isSupportedModel } from "@/lib/ai/models";

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

  it("skips malformed runtime registry entries safely", () => {
    const originalModels = [...AI_MODELS];
    const malformedEntry = {} as Record<string, unknown>;
    Object.defineProperty(malformedEntry, "id", {
      configurable: true,
      get() {
        throw new Error("id getter failed");
      },
    });
    Object.defineProperty(malformedEntry, "label", {
      configurable: true,
      value: "Malformed model",
    });
    Object.defineProperty(malformedEntry, "provider", {
      configurable: true,
      value: "openai",
    });

    try {
      AI_MODELS.splice(
        0,
        AI_MODELS.length,
        malformedEntry as unknown as (typeof AI_MODELS)[number],
        ...originalModels,
      );
      expect(isSupportedModel("gpt-4o")).toBe(true);
      expect(getModelConfig("gpt-4o").id).toBe("gpt-4o");
    } finally {
      AI_MODELS.splice(0, AI_MODELS.length, ...originalModels);
    }
  });

  it("falls back to default config when registry is empty", () => {
    const originalModels = [...AI_MODELS];

    try {
      AI_MODELS.splice(0, AI_MODELS.length);
      expect(isSupportedModel("gpt-4o")).toBe(false);
      expect(getModelConfig("gpt-4o")).toEqual({
        id: "gpt-4o",
        label: "OpenAI GPT-4o",
        provider: "openai",
      });
    } finally {
      AI_MODELS.splice(0, AI_MODELS.length, ...originalModels);
    }
  });
});
