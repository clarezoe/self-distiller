import { describe, expect, it } from "vitest";
import { redactCalibration, type CalibrationRow } from "./calibrations";

// CRITICAL INVARIANT (PRD §23.9): the hidden agent answer must NEVER be exposed before the
// user submits their own answer. These tests pin the single chokepoint that every client-facing
// selector funnels through.

function baseRow(overrides: Partial<CalibrationRow> = {}): CalibrationRow {
  return {
    id: "cal_1",
    projectId: "proj_1",
    contextCombinationId: "combo_1",
    scenario: "A friend says: I feel like a failure lately.",
    incomingMessage: null,
    hiddenAgentAnswer: "SECRET-PREDICTION-DO-NOT-LEAK",
    userAnswer: null,
    comparisonReport: null,
    updateProposal: null,
    userDecision: null,
    createdAt: new Date("2026-06-22T00:00:00.000Z"),
    ...overrides,
  };
}

describe("redactCalibration", () => {
  it("withholds the hidden answer before the user has answered", () => {
    const out = redactCalibration(baseRow({ userAnswer: null }));
    expect(out.hiddenRevealed).toBe(false);
    expect(out.hiddenAgentAnswer).toBeNull();
    // The whole serialized payload must not contain the secret.
    expect(JSON.stringify(out)).not.toContain("SECRET-PREDICTION-DO-NOT-LEAK");
  });

  it("also withholds comparison/proposal while userAnswer is null (defense in depth)", () => {
    const out = redactCalibration(
      baseRow({
        userAnswer: null,
        // Even if these were somehow set, they must stay hidden until an answer exists.
        comparisonReport: { summary: "leak-via-report SECRET-PREDICTION-DO-NOT-LEAK" },
        updateProposal: { values: {} },
      }),
    );
    expect(out.comparisonReport).toBeNull();
    expect(out.updateProposal).toBeNull();
    expect(JSON.stringify(out)).not.toContain("SECRET-PREDICTION-DO-NOT-LEAK");
  });

  it("reveals the hidden answer + report + proposal once the user has answered", () => {
    const report = { summary: "agent was too gentle", differences: [] };
    const proposal = { summary: "be more direct", affected_paths: ["scene_models.comforting"], values: {} };
    const out = redactCalibration(
      baseRow({
        userAnswer: "Don't say that so quickly. What happened?",
        comparisonReport: report,
        updateProposal: proposal,
      }),
    );
    expect(out.hiddenRevealed).toBe(true);
    expect(out.hiddenAgentAnswer).toBe("SECRET-PREDICTION-DO-NOT-LEAK");
    expect(out.comparisonReport).toEqual(report);
    expect(out.updateProposal).toEqual(proposal);
    expect(out.userAnswer).toBe("Don't say that so quickly. What happened?");
  });

  it("never leaks the secret as a raw scalar property when withheld", () => {
    const out = redactCalibration(baseRow({ userAnswer: null }));
    // No property on the redacted object should equal the secret.
    expect(Object.values(out)).not.toContain("SECRET-PREDICTION-DO-NOT-LEAK");
  });

  it("treats an empty-string answer as answered (it is non-null), revealing", () => {
    // setUserAnswer enforces min(1) at the route layer; redaction keys strictly on null.
    const out = redactCalibration(baseRow({ userAnswer: "" }));
    expect(out.hiddenRevealed).toBe(true);
    expect(out.hiddenAgentAnswer).toBe("SECRET-PREDICTION-DO-NOT-LEAK");
  });
});
