// Interview Extractor prompt (PRD §13.3, §14.3, §15.1).
// Extracts BOTH what the user said and HOW they said it, plus a classified update proposal.

import type { JsonSchema, LlmMessage } from "@/lib/llm/types";

// NOTE: sent with strict:false. The update_proposal carries open-ended `values`
// (a partial Self Model §12 fragment with user-defined context keys) and
// `affected_paths`, which OpenAI strict mode forbids (open maps / additionalProperties:true).
// Mirrors how self-model/generate.ts sends the Self Model schema with strict:false.
export const INTERVIEW_EXTRACTION_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    // Language the interview was conducted in (echoed back so the report records it).
    language: { type: "string" },
    explicit_facts: { type: "array", items: { type: "string" } },
    preferences: { type: "array", items: { type: "string" } },
    tone_patterns: { type: "array", items: { type: "string" } },
    reaction_patterns: { type: "array", items: { type: "string" } },
    correction_behavior: { type: "array", items: { type: "string" } },
    role_specific_behavior: { type: "array", items: { type: "string" } },
    relationship_specific_behavior: { type: "array", items: { type: "string" } },
    language_specific_behavior: { type: "array", items: { type: "string" } },
    evidence_quotes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim: { type: "string" },
          quote: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["claim", "quote"],
      },
    },
    update_proposal: {
      type: "object",
      properties: {
        summary: { type: "string" },
        // §15.1 update level — gates how aggressively the merge applies.
        update_level: {
          type: "string",
          enum: ["temporary_state", "context", "language", "relationship", "core"],
        },
        // Dotted §12 paths the merge touches, e.g. "relationship_models.close_friend",
        // "scene_models.comforting", "language_models.zh", "core_self.values".
        affected_paths: { type: "array", items: { type: "string" } },
        // Partial §12 Self Model fragment to merge in (open shape, dynamic context keys).
        values: { type: "object" },
        confidence: { type: "number" },
        evidence_needed: { type: "boolean" },
      },
      required: ["summary", "update_level", "affected_paths", "values"],
    },
  },
  required: [
    "summary",
    "tone_patterns",
    "reaction_patterns",
    "correction_behavior",
    "evidence_quotes",
    "update_proposal",
  ],
};

export type InterviewUpdateLevel = "temporary_state" | "context" | "language" | "relationship" | "core";

export type InterviewUpdateProposal = {
  summary: string;
  update_level: InterviewUpdateLevel;
  affected_paths: string[];
  values: Record<string, unknown>;
  confidence?: number;
  evidence_needed?: boolean;
};

export type InterviewExtractionResult = {
  summary: string;
  language?: string;
  explicit_facts?: string[];
  preferences?: string[];
  tone_patterns: string[];
  reaction_patterns: string[];
  correction_behavior: string[];
  role_specific_behavior?: string[];
  relationship_specific_behavior?: string[];
  language_specific_behavior?: string[];
  evidence_quotes: Array<{ claim: string; quote: string; confidence?: number }>;
  update_proposal: InterviewUpdateProposal;
};

const SYSTEM = `You extract model-relevant information from an interview transcript.

Do NOT only summarize what the user said. ALSO analyze HOW they said it (PRD §13.3, §14.3).
The transcript alternates between the interviewer (agent, in persona) and the user.

Extract:
1. explicit_facts — concrete facts/background stated.
2. preferences — likes/dislikes/preferences revealed.
3. tone_patterns — tone, directness, warmth, formality, sentence length, emoji/filler use.
4. reaction_patterns — how the user reacts, pushes back, hesitates, structures thoughts.
5. correction_behavior — any time the user corrects the interviewer or the framing. THIS IS HIGH-VALUE; capture it precisely.
6. role_specific_behavior / relationship_specific_behavior / language_specific_behavior — patterns tied to the target context.
7. evidence_quotes — quote the user VERBATIM. Never invent or paraphrase quotes.

Then produce ONE update_proposal classified by level (PRD §15.1):
- "temporary_state": a momentary mood/state (recently anxious/irritated/busy). Do NOT make it a personality rule.
- "context": a scene-specific pattern (e.g. as a boss handling delays, more direct).
- "language": a language-specific pattern (e.g. Swedish word-order mistakes decreasing).
- "relationship": a relationship-specific pattern (e.g. with close friends, shorter + more direct).
- "core": a stable core-self trait. CORE updates require MULTIPLE pieces of repeated, high-stability evidence — do NOT promote a single interview into a core rule. If evidence is thin, set evidence_needed=true and choose a non-core level.

update_proposal.values is a PARTIAL Self Model fragment (§12 shape) to merge:
- For relationship/role/scene/language patterns, nest under the matching map with a natural key, e.g.
  { "relationship_models": { "close_friend": { "style_summary": "...", "reply_length": "short" } } }
  { "scene_models": { "comforting": { "default_intent": "...", "typical_structure": ["...","..."] } }
  { "language_models": { "zh": { "tone_patterns": ["..."] } } }
- For temporary_state, nest under current_state, e.g. { "current_state": { "temporary_mood_patterns": ["..."] } }.
- For core (only with strong support), nest under core_self.
update_proposal.affected_paths lists the dotted §12 paths you touched (e.g. "relationship_models.close_friend", "scene_models.comforting").
Only include paths/values the transcript actually supports. Do not fabricate.`;

export function buildInterviewExtractorMessages(input: {
  goal: string;
  interviewerPersona: string;
  type: string;
  targetContexts?: string[];
  transcript: Array<{ speaker: string; text: string }>;
  // Language the interview was CONDUCTED in. Independent of UI locale; may be unset for old interviews.
  language?: string;
}): LlmMessage[] {
  const transcriptBlock = input.transcript
    .map((t) => `${t.speaker === "user" ? "USER" : "INTERVIEWER"}: ${t.text}`)
    .join("\n");

  const contextLine =
    input.targetContexts && input.targetContexts.length > 0
      ? `Target context(s): ${input.targetContexts.join(", ")}`
      : "Target context: not specified.";

  const language = input.language?.trim();
  const languageLine = language
    ? `Interview language: ${language}. The interview was conducted in ${language}; attribute language-specific patterns to ${language} (e.g. nest language patterns under language_models.${language}), and set the report's "language" field to ${language}.`
    : `Interview language: not specified — attribute language-specific patterns to the user's language generally.`;

  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        `Interview type: ${input.type}`,
        `Interview goal: ${input.goal}`,
        `Interviewer persona: ${input.interviewerPersona}`,
        languageLine,
        contextLine,
        "",
        "Transcript:",
        '"""',
        transcriptBlock,
        '"""',
        "",
        "Extract the structured fields AND one classified update_proposal as JSON. Quote the user verbatim in evidence_quotes.",
      ].join("\n"),
    },
  ];
}
