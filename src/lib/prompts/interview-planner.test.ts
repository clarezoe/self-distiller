import { describe, expect, it } from "vitest";
import { buildInterviewPlannerMessages } from "./interview-planner";

const base = { type: "relationship", interviewerPersona: "Blunt cofounder" };

describe("interviewer voice profile block", () => {
  it("appears when a voice profile is given", () => {
    const user = buildInterviewPlannerMessages({ ...base, interviewerVoiceProfile: "Tone: blunt\nExample lines:\n- ok but why" })[1].content;
    expect(user).toContain("real speaking style");
    expect(user).toContain("Tone: blunt");
    expect(user).toContain("MUST match this style");
  });

  it("is absent otherwise", () => {
    for (const v of [undefined, "", "   "]) {
      const user = buildInterviewPlannerMessages({ ...base, interviewerVoiceProfile: v })[1].content;
      expect(user).not.toContain("real speaking style");
    }
  });
});
