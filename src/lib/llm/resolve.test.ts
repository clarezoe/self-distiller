import { describe, expect, it } from "vitest";
import { resolveProviderModel, getAdapter, DEFAULT_MODELS } from "./resolve";

describe("resolveProviderModel", () => {
  it("falls back to openai_compatible + default model when no settings", () => {
    const r = resolveProviderModel(null, { agentRole: "output_generator" });
    expect(r.provider).toBe("openai_compatible");
    expect(r.model).toBe(DEFAULT_MODELS.openai_compatible);
  });

  it("uses the user's default provider + model", () => {
    const r = resolveProviderModel(
      { defaultProvider: "anthropic", defaultModel: "claude-opus-4-8" },
      { agentRole: "blind_comparator" },
    );
    expect(r.provider).toBe("anthropic");
    expect(r.model).toBe("claude-opus-4-8");
  });

  it("per-agent override beats the user default model", () => {
    const r = resolveProviderModel(
      {
        defaultProvider: "anthropic",
        defaultModel: "claude-sonnet-4-6",
        agentOverrides: { blind_comparator: "claude-opus-4-8" },
      },
      { agentRole: "blind_comparator" },
    );
    expect(r.model).toBe("claude-opus-4-8");
  });

  it("explicit overrides beat everything", () => {
    const r = resolveProviderModel(
      { defaultProvider: "anthropic", defaultModel: "claude-sonnet-4-6" },
      { agentRole: "output_generator", providerOverride: "openai_compatible", modelOverride: "gpt-4o" },
    );
    expect(r.provider).toBe("openai_compatible");
    expect(r.model).toBe("gpt-4o");
  });

  it("falls back to provider default model when only provider is set", () => {
    const r = resolveProviderModel(
      { defaultProvider: "anthropic" },
      { agentRole: "import_analyzer" },
    );
    expect(r.model).toBe(DEFAULT_MODELS.anthropic);
  });
});

describe("getAdapter", () => {
  it("returns the matching adapter", () => {
    expect(getAdapter("openai_compatible").provider).toBe("openai_compatible");
    expect(getAdapter("anthropic").provider).toBe("anthropic");
  });
});
