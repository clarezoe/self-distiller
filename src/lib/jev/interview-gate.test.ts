import { describe, expect, it } from "vitest";
import { buildGateRequest, coveredFromAnswers, evaluateGate, regenerationNote } from "./interview-gate";

describe("evaluateGate", () => {
  it("passes when all >= threshold and reports minScore", () => {
    const r = evaluateGate({ responds: 0.9, in_character: 0.5, not_repeat: 0.96 });
    expect(r).toEqual({ pass: true, failed: [], minScore: 0.5 });
  });
  it("lists failed questions", () => {
    const r = evaluateGate({ responds: 0.2, in_character: 0.9, not_repeat: 0.02 });
    expect(r.pass).toBe(false);
    expect(r.failed).toEqual(["responds", "not_repeat"]);
    expect(r.minScore).toBe(0.02);
  });
  it("respects custom threshold", () => {
    expect(evaluateGate({ responds: 0.6, in_character: 0.6, not_repeat: 0.6 }, 0.7).pass).toBe(false);
  });
});

describe("buildGateRequest", () => {
  const transcript = Array.from({ length: 20 }, (_, i) => ({
    speaker: (i % 2 === 0 ? "agent" : "user") as "agent" | "user",
    text: `msg ${i}`,
  }));
  const req = buildGateRequest({
    language: "zh",
    persona: "friend",
    goal: "g",
    transcript,
    candidate: "next?",
    plannedTurns: [{ purpose: "a" }, { purpose: "b" }, { purpose: "c" }],
    coveredIndexes: new Set([1]),
  });
  it("trims transcript, includes candidate and last user message", () => {
    const t = req.state.transcript as Array<{ speaker: string; text: string }>;
    expect(t).toHaveLength(12);
    expect(t[11]).toEqual({ speaker: "user", text: "msg 19" });
    expect(t[0].speaker).toBe("interviewer");
    expect(req.state.candidate_next_interviewer_message).toBe("next?");
  });
  it("asks only about unmet purposes", () => {
    expect(Object.keys(req.questions).sort()).toEqual(
      ["covered_0", "covered_2", "in_character", "not_repeat", "responds"].sort(),
    );
    expect(req.state.planned_purposes).toEqual([
      { index: 0, purpose: "a" },
      { index: 2, purpose: "c" },
    ]);
  });
});

describe("helpers", () => {
  it("coveredFromAnswers uses 0.7", () => {
    expect(coveredFromAnswers({ covered_0: 0.7, covered_2: 0.69, responds: 1 })).toEqual([0]);
  });
  it("regenerationNote names failures", () => {
    expect(regenerationNote(["responds", "not_repeat"])).toContain("ignored what the user just said");
    expect(regenerationNote(["in_character"], "zh")).toContain("zh");
  });
});
