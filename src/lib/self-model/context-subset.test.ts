import { describe, expect, it } from "vitest";
import { buildSelfModelSubset, buildContextSummary } from "./context-subset";
import type { SelfModelJson } from "./schema";

function model(): SelfModelJson {
  return {
    version: "0.2",
    core_self: { values: ["directness"] },
    language_models: { zh: { voice_summary: "short, direct" } },
    role_models: { boss: { style_summary: "blunt" } },
    relationship_models: {
      close_friend: { style_summary: "warm but blunt", reply_length: "short" },
      younger_sister: { style_summary: "teasing" },
    },
    scene_models: { comforting: { default_intent: "validate then probe" } },
    current_state: {},
    boundaries: { sensitive_topics: ["breakups"] },
    unknowns: [],
  };
}

describe("buildSelfModelSubset", () => {
  it("matches a context name to a normalized dynamic key", () => {
    const subset = buildSelfModelSubset(model(), {
      contexts: [{ type: "relationship", name: "Close friend" }],
    });
    expect(subset.relationship_models).toEqual({
      close_friend: { style_summary: "warm but blunt", reply_length: "short" },
    });
    // Sibling key not pulled in.
    expect((subset.relationship_models as Record<string, unknown>).younger_sister).toBeUndefined();
  });

  it("always includes core_self and boundaries when present", () => {
    const subset = buildSelfModelSubset(model(), {
      contexts: [{ type: "scene", name: "comforting" }],
    });
    expect(subset.core_self).toEqual({ values: ["directness"] });
    expect(subset.boundaries).toEqual({ sensitive_topics: ["breakups"] });
    expect(subset.scene_models).toEqual({ comforting: { default_intent: "validate then probe" } });
  });

  it("combines multiple dimensions into their respective sections", () => {
    const subset = buildSelfModelSubset(model(), {
      contexts: [
        { type: "language", name: "zh" },
        { type: "role", name: "Boss" },
      ],
    });
    expect(subset.language_models).toEqual({ zh: { voice_summary: "short, direct" } });
    expect(subset.role_models).toEqual({ boss: { style_summary: "blunt" } });
  });

  it("omits a section when no key matches the context name", () => {
    const subset = buildSelfModelSubset(model(), {
      contexts: [{ type: "relationship", name: "stranger" }],
    });
    expect(subset.relationship_models).toBeUndefined();
  });

  it("returns an empty subset when the model is null", () => {
    expect(buildSelfModelSubset(null, { contexts: [{ type: "scene", name: "comforting" }] })).toEqual({});
  });
});

describe("buildContextSummary", () => {
  it("lists each dimension and the combination name", () => {
    const summary = buildContextSummary({
      combinationName: "zh + close friend + comforting",
      contexts: [
        { type: "language", name: "Chinese" },
        { type: "relationship", name: "Close friend" },
        { type: "scene", name: "Comforting" },
      ],
    });
    expect(summary).toContain("Combination: zh + close friend + comforting");
    expect(summary).toContain("- language: Chinese");
    expect(summary).toContain("- relationship: Close friend");
    expect(summary).toContain("- scene: Comforting");
  });

  it("falls back to a general message with no contexts", () => {
    expect(buildContextSummary({ contexts: [] })).toMatch(/general voice/);
  });
});
