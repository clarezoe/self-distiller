// Persona Voice Distiller prompt (GitHub #15, partial).
// Turns sample messages written BY an interviewer persona into a compact speaking-style
// profile, so the interview planner does not have to guess how that person talks.
// The raw samples are used for this one call only and are never persisted by callers.

import type { JsonSchema, LlmMessage } from "@/lib/llm/types";

export const VOICE_SAMPLES_MIN = 200;
export const VOICE_SAMPLES_MAX = 20000;
export const VOICE_PROFILE_MAX = 3000;

// Strict-mode compatible: all properties required, additionalProperties:false.
export const PERSONA_VOICE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    tone: { type: "string" },
    sentence_style: { type: "string" },
    vocabulary_and_phrases: { type: "array", items: { type: "string" } },
    emoji_and_formatting: { type: "string" },
    how_they_ask_and_push: { type: "string" },
    language_mix: { type: "string" },
    example_lines: { type: "array", items: { type: "string" } },
  },
  required: [
    "tone",
    "sentence_style",
    "vocabulary_and_phrases",
    "emoji_and_formatting",
    "how_they_ask_and_push",
    "language_mix",
    "example_lines",
  ],
  additionalProperties: false,
};

export type PersonaVoice = {
  tone: string;
  sentence_style: string;
  vocabulary_and_phrases: string[];
  emoji_and_formatting: string;
  how_they_ask_and_push: string;
  language_mix: string;
  example_lines: string[];
};

const SYSTEM = `You distill how ONE specific person writes and talks, from messages they wrote.

Hard rules:
- Describe ONLY what the samples actually show. Do NOT invent traits, backstory, or habits the samples do not demonstrate. If a dimension has no signal, say "no clear signal".
- "vocabulary_and_phrases": typical words, catchphrases, and sentence openers/closers, QUOTED from the samples.
- "sentence_style": typical message length, sentence structure, punctuation habits (e.g. no periods, many "...", all lowercase).
- "emoji_and_formatting": emoji, stickers, caps, line breaks, lists, etc. and how often.
- "how_they_ask_and_push": how they ask questions, make requests, disagree, or press for an answer.
- "language_mix": languages used, code-switching, dialect, slang.
- "example_lines": 3-6 SHORT lines taken verbatim (or near-verbatim) from the samples that best represent the voice. Do not include names, phone numbers, addresses, or other identifying details; replace them with "[…]".
- Be concise. Total output should stay under about 2000 characters.
- Write the descriptions in English, but keep quotes in their original language.`;

export function buildPersonaVoiceDistillerMessages(input: {
  name: string;
  relationship?: string | null;
  description: string;
  samples: string;
}): LlmMessage[] {
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        `Person: ${input.name}${input.relationship ? ` (${input.relationship})` : ""}`,
        `Background description: ${input.description}`,
        "Messages written by this person (their lines only):",
        "<<<SAMPLES",
        input.samples,
        "SAMPLES>>>",
        "\nReturn the speaking-style profile as structured JSON.",
      ].join("\n"),
    },
  ];
}

function bullets(items: string[] | undefined): string {
  return (items ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `- ${s}`)
    .join("\n");
}

// Pure: compact text voiceProfile from the distiller's JSON. Capped at VOICE_PROFILE_MAX.
export function formatVoiceProfile(voice: Partial<PersonaVoice>): string {
  const sections: Array<[string, string]> = [
    ["Tone", voice.tone?.trim() ?? ""],
    ["Sentence style", voice.sentence_style?.trim() ?? ""],
    ["Typical words and phrases", bullets(voice.vocabulary_and_phrases)],
    ["Emoji and formatting", voice.emoji_and_formatting?.trim() ?? ""],
    ["How they ask and push", voice.how_they_ask_and_push?.trim() ?? ""],
    ["Language mix", voice.language_mix?.trim() ?? ""],
    ["Example lines", bullets(voice.example_lines)],
  ];
  const text = sections
    .filter(([, body]) => body)
    .map(([title, body]) => (body.startsWith("- ") ? `${title}:\n${body}` : `${title}: ${body}`))
    .join("\n");
  return text.length > VOICE_PROFILE_MAX ? text.slice(0, VOICE_PROFILE_MAX) : text;
}
