import { describe, expect, it } from "vitest";
import { buildInterviewPlannerMessages } from "./interview-planner";
import { buildInterviewExtractorMessages } from "./interview-extractor";

function userContent(messages: { role: string; content: string }[]): string {
  return messages.find((m) => m.role === "user")?.content ?? "";
}

describe("buildInterviewPlannerMessages — interview language", () => {
  it("threads the chosen language into the prompt and instructs every turn be in it", () => {
    const content = userContent(
      buildInterviewPlannerMessages({
        type: "relationship",
        interviewerPersona: "close friend",
        language: "sv",
      }),
    );
    expect(content).toContain("Interview language: sv");
    expect(content).toContain("Conduct the ENTIRE interview in sv");
    expect(content).toContain("write EVERY question/turn");
  });

  it("omits the language clause when no language is given (old/unset interviews)", () => {
    const content = userContent(
      buildInterviewPlannerMessages({
        type: "relationship",
        interviewerPersona: "close friend",
      }),
    );
    expect(content).not.toContain("Interview language:");
    expect(content).not.toContain("Conduct the ENTIRE interview");
  });

  it("trims whitespace-only language to nothing", () => {
    const content = userContent(
      buildInterviewPlannerMessages({
        type: "role",
        interviewerPersona: "subordinate",
        language: "   ",
      }),
    );
    expect(content).not.toContain("Interview language:");
  });
});

describe("buildInterviewExtractorMessages — interview language", () => {
  const transcript = [
    { speaker: "agent", text: "fråga" },
    { speaker: "user", text: "svar" },
  ];

  it("attributes language-specific patterns to the conducted language and records it", () => {
    const content = userContent(
      buildInterviewExtractorMessages({
        goal: "g",
        interviewerPersona: "p",
        type: "language",
        transcript,
        language: "sv",
      }),
    );
    expect(content).toContain("Interview language: sv");
    expect(content).toContain("conducted in sv");
    expect(content).toContain("language_models.sv");
  });

  it("falls back gracefully when language is unset", () => {
    const content = userContent(
      buildInterviewExtractorMessages({
        goal: "g",
        interviewerPersona: "p",
        type: "language",
        transcript,
      }),
    );
    expect(content).toContain("not specified");
    expect(content).toContain("user's language generally");
  });
});
