import { describe, expect, it } from "vitest";
import { buildPersonaVoiceDistillerMessages, formatVoiceProfile, voiceEvidenceLevel, VOICE_PROFILE_MAX } from "./persona-voice-distiller";

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

describe("voiceEvidenceLevel", () => {
  it("buckets by cumulative characters", () => {
    expect(voiceEvidenceLevel(0)).toBe("rough");
    expect(voiceEvidenceLevel(499)).toBe("rough");
    expect(voiceEvidenceLevel(500)).toBe("fair");
    expect(voiceEvidenceLevel(1999)).toBe("fair");
    expect(voiceEvidenceLevel(2000)).toBe("good");
  });
});

describe("buildPersonaVoiceDistillerMessages existing profile", () => {
  const base = { name: "Ann", description: "terse", samples: "new stuff" };
  it("includes the existing profile only when provided", () => {
    const withProfile = buildPersonaVoiceDistillerMessages({ ...base, existingProfile: "Tone: blunt" });
    expect(withProfile[1].content).toContain("Tone: blunt");
    expect(withProfile[1].content).toContain("new stuff");
    const without = buildPersonaVoiceDistillerMessages(base);
    expect(without[1].content).not.toContain("EXISTING_PROFILE");
    const empty = buildPersonaVoiceDistillerMessages({ ...base, existingProfile: "  " });
    expect(empty[1].content).not.toContain("EXISTING_PROFILE");
  });
});
