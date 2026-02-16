import { describe, it, expect } from "vitest";
import { AI_MODELS, DEFAULT_MODEL, getModel } from "./models";

describe("AI Models", () => {
  it("has at least 4 models defined", () => {
    expect(AI_MODELS.length).toBeGreaterThanOrEqual(4);
  });

  it("each model has required fields", () => {
    for (const model of AI_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(["openai", "anthropic", "google"]).toContain(model.provider);
      expect(model.maxTokens).toBeGreaterThan(0);
      expect(model.contextWindow).toBeGreaterThan(0);
    }
  });

  it("has unique model IDs", () => {
    const ids = AI_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("DEFAULT_MODEL is a valid model ID", () => {
    const model = getModel(DEFAULT_MODEL);
    expect(model).toBeDefined();
  });

  it("getModel returns correct model", () => {
    const model = getModel("gpt-4o");
    expect(model?.name).toBe("GPT-4o");
    expect(model?.provider).toBe("openai");
  });

  it("getModel returns undefined for invalid ID", () => {
    expect(getModel("nonexistent")).toBeUndefined();
  });

  it("includes expected providers", () => {
    const providers = new Set(AI_MODELS.map((m) => m.provider));
    expect(providers.has("openai")).toBe(true);
    expect(providers.has("anthropic")).toBe(true);
    expect(providers.has("google")).toBe(true);
  });
});
