import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  AI_MODELS,
  DEFAULT_CHAT_MODEL_IDS,
  DEFAULT_MODEL,
  VISIBLE_MODELS,
  getChatModels,
  getModel,
} from "./models";

describe("AI Models", () => {
  it("has at least 4 models defined", () => {
    expect(AI_MODELS.length).toBeGreaterThanOrEqual(4);
  });

  it("each model has required fields", () => {
    for (const model of AI_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(["openai", "anthropic", "google", "xai"]).toContain(model.provider);
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

  it("supports GPT-5.5 and Claude Opus 4.8", () => {
    expect(getModel("gpt-5.5")).toMatchObject({
      name: "GPT-5.5",
      provider: "openai",
    });
    expect(getModel("claude-opus-4-8")).toMatchObject({
      name: "Claude Opus 4.8",
      provider: "anthropic",
    });
  });

  it("shows GPT-5.5 and Claude Opus 4.8 in the selector", () => {
    const visibleIds = VISIBLE_MODELS.map((model) => model.id);

    expect(visibleIds).toContain("gpt-5.5");
    expect(visibleIds).toContain("claude-opus-4-8");
  });

  it("supports the latest model generation", () => {
    expect(getModel("gpt-5.6-sol")).toMatchObject({
      name: "GPT-5.6 Sol",
      provider: "openai",
    });
    expect(getModel("gpt-5.6-terra")).toMatchObject({
      name: "GPT-5.6 Terra",
      provider: "openai",
    });
    expect(getModel("gpt-5.6-luna")).toMatchObject({
      name: "GPT-5.6 Luna",
      provider: "openai",
      maxTokens: 128000,
      contextWindow: 1050000,
    });
    expect(getModel("claude-opus-5")).toMatchObject({
      name: "Claude Opus 5",
      provider: "anthropic",
    });
    expect(getModel("claude-fable-5")).toMatchObject({
      name: "Claude Fable 5",
      provider: "anthropic",
    });
    expect(getModel("claude-sonnet-5")).toMatchObject({
      name: "Claude Sonnet 5",
      provider: "anthropic",
    });
    expect(getModel("grok-4.5")).toMatchObject({
      name: "Grok 4.5",
      provider: "xai",
    });
  });

  it("shows the latest model generation in the selector", () => {
    const visibleIds = VISIBLE_MODELS.map((model) => model.id);

    expect(visibleIds).toContain("gpt-5.6-sol");
    expect(visibleIds).toContain("gpt-5.6-terra");
    expect(visibleIds).toContain("gpt-5.6-luna");
    expect(visibleIds).toContain("claude-opus-5");
    expect(visibleIds).toContain("claude-fable-5");
    expect(visibleIds).toContain("claude-sonnet-5");
    expect(visibleIds).toContain("grok-4.5");
  });

  it("defaults to GPT-5.6 Sol", () => {
    expect(DEFAULT_MODEL).toBe("gpt-5.6-sol");
  });

  it("shows the GPT-5.6 family and 4o in chat by default", () => {
    expect(DEFAULT_CHAT_MODEL_IDS).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-4o",
    ]);
    expect(getChatModels().map((model) => model.id)).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-4o",
    ]);
  });

  it("resolves a saved chat model allowlist against visible models", () => {
    expect(
      getChatModels([
        "gpt-5.6-luna",
        "gpt-4o",
        "gpt-5-mini",
        "nonexistent",
        "gpt-4o",
      ]).map((model) => model.id)
    ).toEqual(["gpt-5.6-luna", "gpt-4o"]);
  });

  it("falls back to the default chat models for an invalid allowlist", () => {
    expect(getChatModels([]).map((model) => model.id)).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-4o",
    ]);
    expect(getChatModels(["nonexistent"]).map((model) => model.id)).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-4o",
    ]);
  });

  it("getModel returns undefined for invalid ID", () => {
    expect(getModel("nonexistent")).toBeUndefined();
  });

  it("includes expected providers", () => {
    const providers = new Set(AI_MODELS.map((m) => m.provider));
    expect(providers.has("openai")).toBe(true);
    expect(providers.has("anthropic")).toBe(true);
    expect(providers.has("google")).toBe(true);
    expect(providers.has("xai")).toBe(true);
  });

  it("every model is routable by the Convex streaming endpoint", () => {
    const httpSource = readFileSync(
      fileURLToPath(new URL("../../convex/http.ts", import.meta.url)),
      "utf8"
    );
    const routed = new Map(
      [...httpSource.matchAll(/"([\w.-]+)":\s*\{\s*provider:\s*"(\w+)"/g)].map(
        (match) => [match[1], match[2]]
      )
    );

    for (const model of AI_MODELS) {
      expect(routed.get(model.id), `${model.id} is not registered in convex/http.ts`).toBe(
        model.provider
      );
    }
  });
});
