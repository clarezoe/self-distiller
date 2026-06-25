import { describe, expect, it } from "vitest";
import { toMarkdown } from "./markdown";
import { emptySelfModel, normalizeSelfModel, type SelfModelJson } from "./schema";

describe("toMarkdown", () => {
  it("renders the version header and empty-section placeholders", () => {
    const md = toMarkdown(emptySelfModel("0.1"));
    expect(md).toContain("# Self Model v0.1");
    expect(md).toContain("## Core Self");
    expect(md).toContain("_No core self captured yet._");
    expect(md).toContain("## Language Models");
    expect(md).toContain("_None yet._");
  });

  it("renders core self bullets, language/role/relationship/scene sections", () => {
    const model: SelfModelJson = {
      version: "0.2",
      core_self: {
        identity: ["Content creator"],
        values: ["Directness", "Honesty"],
        stable_dislikes: ["Marketing fluff"],
      },
      language_models: {
        zh: {
          voice_summary: "Short, direct, warm",
          tone_patterns: ["casual", "playful"],
          confidence: 0.8,
        },
        sv: {
          current_level: "intermediate",
          common_mistakes: ["word order"],
        },
      },
      role_models: {
        boss: {
          style_summary: "Direct but not harsh",
          feedback_style: "Asks for a delivery time first",
          evidence_ids: ["ev_1"],
        },
      },
      relationship_models: {
        close_friend: { style_summary: "Short replies", emoji_policy: "preserve" },
      },
      scene_models: {
        comforting: { default_intent: "Validate then re-frame", avoid: ["lecturing"] },
      },
      current_state: { recent_changes: ["busier lately"] },
      boundaries: { sensitive_topics: ["breakups"] },
      unknowns: ["English work tone"],
      suggested_interviews: [
        { goal: "Sample boss feedback under delay", interviewer_persona: "subordinate" },
      ],
    };

    const md = toMarkdown(model);
    expect(md).toContain("# Self Model v0.2");
    expect(md).toContain("- Content creator");
    expect(md).toContain("- Directness");
    expect(md).toContain("### zh");
    expect(md).toContain("Short, direct, warm");
    expect(md).toContain("**Tone patterns:** casual, playful");
    expect(md).toContain("**Confidence:** 0.8");
    expect(md).toContain("### sv");
    expect(md).toContain("### boss");
    expect(md).toContain("Asks for a delivery time first");
    expect(md).toContain("### close_friend");
    expect(md).toContain("### comforting");
    expect(md).toContain("## Current State");
    expect(md).toContain("## Boundaries");
    expect(md).toContain("breakups");
    expect(md).toContain("## Unknowns");
    expect(md).toContain("English work tone");
    expect(md).toContain("## Suggested Interviews");
    expect(md).toContain("Sample boss feedback under delay");
  });

  it("renders open-ended nested shapes (objects + arrays-of-objects) without [object Object]", () => {
    // The real generated model nests objects/arrays where the narrow TS types expect strings.
    const model = {
      ...emptySelfModel("0.3"),
      language_models: {
        sv: {
          register: {
            default: "informal, practical, friendly",
            close_friends: "casual Swedish with emoji",
          },
          voice_features: [
            {
              feature: "Uses Swedish for everyday coordination.",
              examples: ["Kan du ta honom i selen"],
              evidence_ids: ["ev_a"],
            },
          ],
          common_mistakes: [
            { type: "spelling", examples: ["biletter instead of biljetter"] },
          ],
          polish_policy: "Keep the user's non-native Swedish flavor.",
          confidence: 0.82,
          evidence_ids: ["ev_a", "ev_b"],
        },
      },
    } as unknown as SelfModelJson;

    const md = toMarkdown(model);
    expect(md).not.toContain("[object Object]");
    expect(md).toContain("### sv");
    expect(md).toContain("**Register:**");
    expect(md).toContain("**Default:** informal, practical, friendly");
    expect(md).toContain("**Voice features:**");
    expect(md).toContain("Uses Swedish for everyday coordination.");
    expect(md).toContain("Kan du ta honom i selen");
    expect(md).toContain("**Common mistakes:**");
    expect(md).toContain("biletter instead of biljetter");
    expect(md).toContain("Keep the user's non-native Swedish flavor.");
    expect(md).toContain("**Confidence:** 0.82");
    expect(md).toContain("**Evidence:** ev_a, ev_b");
  });

  it("collapses excessive blank lines and ends with a single newline", () => {
    const md = toMarkdown(emptySelfModel());
    expect(md).not.toMatch(/\n{3,}/);
    expect(md.endsWith("\n")).toBe(true);
  });
});

describe("normalizeSelfModel", () => {
  it("fills missing keys and stamps the version", () => {
    const norm = normalizeSelfModel({ core_self: { values: ["x"] } }, "0.3");
    expect(norm.version).toBe("0.3");
    expect(norm.core_self.values).toEqual(["x"]);
    expect(norm.language_models).toEqual({});
    expect(norm.unknowns).toEqual([]);
    expect(Array.isArray(norm.suggested_interviews)).toBe(true);
  });

  it("returns a complete empty model for null input", () => {
    const norm = normalizeSelfModel(null, "0.1");
    expect(norm.version).toBe("0.1");
    expect(norm.role_models).toEqual({});
    expect(norm.boundaries).toEqual({});
  });

  it("coerces a non-array unknowns into []", () => {
    const norm = normalizeSelfModel(
      { unknowns: "oops" as unknown as string[] },
      "0.1",
    );
    expect(norm.unknowns).toEqual([]);
  });
});
