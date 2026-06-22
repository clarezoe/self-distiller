import { describe, expect, it } from "vitest";
import { applyProposal, resolveAffectedPaths } from "./apply";
import { emptySelfModel, type SelfModelJson } from "./schema";

function baseModel(): SelfModelJson {
  return {
    version: "0.2",
    core_self: {
      identity: ["content creator"],
      values: ["honesty"],
    },
    language_models: {
      zh: { voice_summary: "direct, short", tone_patterns: ["casual"], confidence: 0.6 },
    },
    role_models: {
      boss: { style_summary: "direct", boundaries: ["no public blame"] },
    },
    relationship_models: {
      close_friend: { style_summary: "warm but blunt", reply_length: "short" },
    },
    scene_models: {
      comforting: { default_intent: "validate then probe", typical_structure: ["ask what happened"] },
    },
    current_state: { temporary_mood_patterns: ["busy"] },
    boundaries: { sensitive_topics: ["breakups"] },
    unknowns: ["english work tone"],
    suggested_interviews: [],
  };
}

describe("applyProposal", () => {
  it("merges a new context-map key without touching siblings", () => {
    const current = baseModel();
    const result = applyProposal(current, {
      values: {
        relationship_models: {
          younger_sister: { style_summary: "teasing, protective" },
        },
      },
    });
    // New key added
    expect(result.relationship_models.younger_sister?.style_summary).toBe("teasing, protective");
    // Sibling key untouched
    expect(result.relationship_models.close_friend?.style_summary).toBe("warm but blunt");
    expect(result.relationship_models.close_friend?.reply_length).toBe("short");
  });

  it("deep-merges fields into an existing context key (overwrite scalar, keep others)", () => {
    const current = baseModel();
    const result = applyProposal(current, {
      values: {
        relationship_models: {
          close_friend: { reply_length: "very short", humor: "dry" },
        },
      },
    });
    expect(result.relationship_models.close_friend?.reply_length).toBe("very short"); // overwritten
    expect(result.relationship_models.close_friend?.humor).toBe("dry"); // added
    expect(result.relationship_models.close_friend?.style_summary).toBe("warm but blunt"); // preserved
  });

  it("array fields union and dedupe, preserving prior items", () => {
    const current = baseModel();
    const result = applyProposal(current, {
      values: {
        scene_models: {
          comforting: { typical_structure: ["ask what happened", "avoid quick fixes"] },
        },
        language_models: {
          zh: { tone_patterns: ["casual", "warm"] },
        },
      },
    });
    expect(result.scene_models.comforting?.typical_structure).toEqual([
      "ask what happened",
      "avoid quick fixes",
    ]);
    expect(result.language_models.zh?.tone_patterns).toEqual(["casual", "warm"]);
  });

  it("does NOT wipe unrelated top-level sections", () => {
    const current = baseModel();
    const result = applyProposal(current, {
      values: {
        scene_models: { complaining: { default_intent: "vent" } },
      },
    });
    // Untouched sections survive intact
    expect(result.core_self.identity).toEqual(["content creator"]);
    expect(result.role_models.boss?.style_summary).toBe("direct");
    expect(result.language_models.zh?.voice_summary).toBe("direct, short");
    expect(result.relationship_models.close_friend?.style_summary).toBe("warm but blunt");
    // New scene added alongside existing one
    expect(result.scene_models.comforting?.default_intent).toBe("validate then probe");
    expect(result.scene_models.complaining?.default_intent).toBe("vent");
  });

  it("merges core_self / current_state / boundaries object sections by field", () => {
    const current = baseModel();
    const result = applyProposal(current, {
      values: {
        core_self: { values: ["directness"], stable_dislikes: ["marketing fluff"] },
        current_state: { recent_changes: ["learning swedish"] },
        boundaries: { sensitive_topics: ["finances"] },
      },
    });
    // values array unions with existing
    expect(result.core_self.values).toEqual(["honesty", "directness"]);
    expect(result.core_self.stable_dislikes).toEqual(["marketing fluff"]);
    expect(result.core_self.identity).toEqual(["content creator"]); // preserved
    expect(result.current_state.recent_changes).toEqual(["learning swedish"]);
    expect(result.current_state.temporary_mood_patterns).toEqual(["busy"]); // preserved
    expect(result.boundaries.sensitive_topics).toEqual(["breakups", "finances"]); // union
  });

  it("unions unknowns when restated", () => {
    const current = baseModel();
    const result = applyProposal(current, {
      values: { unknowns: ["english work tone", "swedish formal email"] },
    });
    expect(result.unknowns).toEqual(["english work tone", "swedish formal email"]);
  });

  it("does not mutate the input model", () => {
    const current = baseModel();
    const snapshot = JSON.stringify(current);
    applyProposal(current, {
      values: { relationship_models: { close_friend: { reply_length: "x" } } },
    });
    expect(JSON.stringify(current)).toBe(snapshot);
  });

  it("returns a usable model from an empty base", () => {
    const result = applyProposal(emptySelfModel(), {
      values: { scene_models: { comforting: { default_intent: "validate" } } },
    });
    expect(result.scene_models.comforting?.default_intent).toBe("validate");
    expect(result.core_self).toEqual({});
    expect(result.unknowns).toEqual([]);
  });

  it("returns current unchanged when proposal has no values", () => {
    const current = baseModel();
    expect(applyProposal(current, {})).toEqual(current);
    expect(applyProposal(current, null)).toEqual(current);
    expect(applyProposal(current, { values: undefined })).toEqual(current);
  });

  it("falls back to empty model when current is null", () => {
    const result = applyProposal(null, { values: { core_self: { values: ["x"] } } });
    expect(result.core_self.values).toEqual(["x"]);
    expect(result.version).toBe("0.1");
  });

  it("ignores non-object incoming sections", () => {
    const current = baseModel();
    const result = applyProposal(current, {
      values: { relationship_models: "nope", core_self: 123 },
    });
    expect(result.relationship_models.close_friend?.style_summary).toBe("warm but blunt");
    expect(result.core_self.identity).toEqual(["content creator"]);
  });
});

describe("resolveAffectedPaths", () => {
  it("dedupes explicit affected_paths", () => {
    expect(
      resolveAffectedPaths({ affected_paths: ["scene_models.comforting", "scene_models.comforting"] }),
    ).toEqual(["scene_models.comforting"]);
  });

  it("infers from values when affected_paths is missing", () => {
    expect(
      resolveAffectedPaths({ values: { relationship_models: {}, scene_models: {} } }),
    ).toEqual(["relationship_models", "scene_models"]);
  });

  it("returns empty for an empty proposal", () => {
    expect(resolveAffectedPaths({})).toEqual([]);
    expect(resolveAffectedPaths(null)).toEqual([]);
  });
});
