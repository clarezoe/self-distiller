import { describe, expect, it } from "vitest";
import { normalizeFeedbackLabels, normalizeFeedback } from "./tasks";

describe("normalizeFeedbackLabels", () => {
  it("keeps known labels, normalizing casing/spacing/hyphens", () => {
    expect(normalizeFeedbackLabels(["Sounds like me", "too-long", "TOO_SHORT"])).toEqual([
      "sounds_like_me",
      "too_long",
      "too_short",
    ]);
  });

  it("dedupes and drops unknown / non-string entries", () => {
    expect(
      normalizeFeedbackLabels(["too_long", "too_long", "made_up_label", 42, null]),
    ).toEqual(["too_long"]);
  });

  it("returns [] for non-array input", () => {
    expect(normalizeFeedbackLabels(undefined)).toEqual([]);
    expect(normalizeFeedbackLabels("too_long")).toEqual([]);
  });
});

describe("normalizeFeedback", () => {
  it("clamps scores to 1-5 integers and drops empties", () => {
    const out = normalizeFeedback({ likeness_score: 9, usefulness_score: 0, comments: "  " });
    expect(out.likeness_score).toBe(5);
    expect(out.usefulness_score).toBe(1);
    expect(out.comments).toBeUndefined();
  });

  it("rounds fractional scores and trims comments", () => {
    const out = normalizeFeedback({ likeness_score: 3.6, comments: "  too soft " });
    expect(out.likeness_score).toBe(4);
    expect(out.comments).toBe("too soft");
  });

  it("omits invalid scores and empty label arrays", () => {
    const out = normalizeFeedback({ likeness_score: NaN, labels: ["nope"] });
    expect(out.likeness_score).toBeUndefined();
    expect(out.labels).toBeUndefined();
  });

  it("keeps only normalized known labels", () => {
    const out = normalizeFeedback({ labels: ["Too AI-like", "wrong-emotional-tone"] });
    expect(out.labels).toEqual(["too_ai_like", "wrong_emotional_tone"]);
  });
});
