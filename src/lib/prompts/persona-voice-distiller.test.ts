import { describe, expect, it } from "vitest";
import { buildPersonaVoiceDistillerMessages, formatVoiceProfile, VOICE_PROFILE_MAX } from "./persona-voice-distiller";

describe("formatVoiceProfile", () => {
  it("formats sections and skips empty ones", () => {
    const text = formatVoiceProfile({
      tone: "blunt",
      sentence_style: "short, no periods",
      vocabulary_and_phrases: ["honestly", " 行吧 "],
      emoji_and_formatting: "",
      example_lines: ["ok but why"],
    });
    expect(text).toContain("Tone: blunt");
    expect(text).toContain("Typical words and phrases:\n- honestly\n- 行吧");
    expect(text).toContain("Example lines:\n- ok but why");
    expect(text).not.toContain("Emoji");
    expect(text).not.toContain("Language mix");
  });

  it("caps the length", () => {
    const text = formatVoiceProfile({ tone: "x".repeat(VOICE_PROFILE_MAX + 500) });
    expect(text.length).toBe(VOICE_PROFILE_MAX);
  });
});

describe("buildPersonaVoiceDistillerMessages", () => {
  it("includes the samples and the no-invention rule", () => {
    const msgs = buildPersonaVoiceDistillerMessages({ name: "Ann", relationship: "boss", description: "terse", samples: "hello there" });
    expect(msgs[0].content).toContain("Do NOT invent");
    expect(msgs[1].content).toContain("hello there");
    expect(msgs[1].content).toContain("Ann (boss)");
  });
});
