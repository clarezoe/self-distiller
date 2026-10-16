import { describe, expect, it } from "vitest";
import { buildInterviewTurnMessages, coveredPlannedIndexes } from "./interview-turn";

const transcript = [
  { speaker: "agent" as const, text: "Why were you late?", plannedIndex: 0 },
  { speaker: "user" as const, text: "Traffic was awful, sorry." },
];
const base = {
  goal: "Sample reaction to delays",
  type: "role",
  interviewerPersona: "Subordinate",
  plannedTurns: [
    { text: "Why were you late?", purpose: "delay reaction" },
    { text: "Can I leave early?", purpose: "boundary" },
  ],
  transcript,
};

describe("coveredPlannedIndexes", () => {
  it("collects plannedIndex from agent turns only", () => {
    const s = coveredPlannedIndexes([
      ...transcript,
      { speaker: "agent", text: "x", plannedIndex: 3 },
      { speaker: "agent", text: "y", plannedIndex: null },
      { speaker: "user", text: "z", plannedIndex: 5 },
    ]);
    expect([...s].sort()).toEqual([0, 3]);
  });

  it("includes coveredIndexes from agent turns", () => {
    const s = coveredPlannedIndexes([
      { speaker: "agent", text: "x", plannedIndex: 0, coveredIndexes: [2, 4] },
      { speaker: "user", text: "z", coveredIndexes: [9] },
    ]);
    expect([...s].sort()).toEqual([0, 2, 4]);
  });
});

describe("buildInterviewTurnMessages", () => {
  it("includes last user message, transcript, and marks covered turns", () => {
    const user = buildInterviewTurnMessages(base)[1].content;
    expect(user).toContain("Traffic was awful, sorry.");
    expect(user).toContain("Subordinate: Why were you late?");
    expect(user).toContain("0. [COVERED]");
    expect(user).toContain("1. [unmet]");
  });

  it("includes voice block and language rule when present, not otherwise", () => {
    const withBoth = buildInterviewTurnMessages({ ...base, interviewerVoiceProfile: "Tone: blunt", language: "sv" })[1].content;
    expect(withBoth).toContain("real speaking style");
    expect(withBoth).toContain("Tone: blunt");
    expect(withBoth).toContain("ENTIRELY in sv");
    const without = buildInterviewTurnMessages(base)[1].content;
    expect(without).not.toContain("real speaking style");
    expect(without).not.toContain("Interview language");
  });

  it("falls back to goal-only when there is no plan", () => {
    const user = buildInterviewTurnMessages({ ...base, plannedTurns: undefined })[1].content;
    expect(user).toContain("No stored plan");
  });
});
