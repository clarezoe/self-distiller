// Blind Calibration — Comparator prompt (PRD §14.2, §13.4, §15.1).
// Compares the hidden agent answer against the user's REAL answer across 10 dimensions.
// Does NOT judge which is better — it identifies how the agent mis-predicted the user, and
// proposes one classified Self Model update.
//
// NOTE: sent with strict:false. update_proposal.values is an open-ended partial Self Model
// (§12) fragment with user-defined context keys, which OpenAI strict mode forbids. Mirrors
// the interview-extractor schema.

import type { JsonSchema, LlmMessage } from "@/lib/llm/types";

export const BLIND_COMPARISON_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    // One entry per dimension where the agent mis-predicted; the dimension list is §13.4.
    differences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dimension: {
            type: "string",
            enum: [
              "intent",
              "emotional_tone",
              "relationship_distance",
              "structure",
              "length",
              "directness",
              "politeness",
              "action_taken",
              "language_quirks",
              "omissions",
              "boundaries",
            ],
          },
          agent: { type: "string" },
          user: { type: "string" },
          note: { type: "string" },
        },
        required: ["dimension", "note"],
      },
    },
    update_proposal: {
      type: "object",
      properties: {
        summary: { type: "string" },
        // Dotted §12 paths the merge touches, e.g. "relationship_models.close_friend".
        affected_paths: { type: "array", items: { type: "string" } },
        // Partial §12 Self Model fragment to merge in (open shape, dynamic context keys).
        values: { type: "object" },
        confidence: { type: "number" },
      },
      required: ["summary", "affected_paths", "values"],
    },
    affected_paths: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
    // §15.1 update level — gates how aggressively the merge should be trusted.
    scope: { type: "string", enum: ["one_off", "context", "long_term"] },
  },
  required: ["summary", "differences", "update_proposal", "scope"],
};

export type ComparisonDimension =
  | "intent"
  | "emotional_tone"
  | "relationship_distance"
  | "structure"
  | "length"
  | "directness"
  | "politeness"
  | "action_taken"
  | "language_quirks"
  | "omissions"
  | "boundaries";

export type ComparisonDifference = {
  dimension: ComparisonDimension;
  agent?: string;
  user?: string;
  note: string;
};

export type BlindUpdateProposal = {
  summary: string;
  affected_paths: string[];
  values: Record<string, unknown>;
  confidence?: number;
};

export type BlindComparisonResult = {
  summary: string;
  differences: ComparisonDifference[];
  update_proposal: BlindUpdateProposal;
  affected_paths?: string[];
  confidence?: number;
  scope: "one_off" | "context" | "long_term";
};

const SYSTEM = `You compare a hidden agent answer against the user's REAL answer in a blind calibration test.

Do NOT judge which answer is better. Identify HOW the agent failed to predict the user (PRD §14.2).

Compare across these dimensions (only report dimensions where they meaningfully differ):
- intent — what each was trying to do.
- emotional_tone — warmth, irritation, flatness, enthusiasm.
- relationship_distance — closeness/formality toward the other person.
- structure — order of ideas, opening, framing.
- length — short vs long, terse vs elaborated.
- directness — blunt vs hedged, asks-first vs explains-first.
- politeness — softeners, apologies, comforting language.
- action_taken — what concrete thing they did (asked for a time, set an expectation, etc.).
- language_quirks — phrasing, slang, emoji/filler, preserved non-native traces.
- omissions — what the user did NOT do that the agent did (or vice versa).
- boundaries — sensitive-topic handling, what they refused to engage with.

For each reported difference, fill agent + user (what each side did on that dimension) and a short note.

Then produce ONE update_proposal that teaches the model to predict THIS user better next time:
- update_proposal.values is a PARTIAL Self Model fragment (§12 shape) to merge. Nest patterns under the
  matching context map with a natural key, e.g.
  { "relationship_models": { "close_friend": { "style_summary": "...", "reply_length": "short" } } }
  { "scene_models": { "comforting": { "default_intent": "...", "typical_structure": ["...","..."], "avoid": ["..."] } } }
  { "language_models": { "zh": { "tone_patterns": ["..."] } } }
  For a momentary state only, nest under current_state.
- update_proposal.affected_paths lists the dotted §12 paths you touched.
- Only include paths/values the comparison actually supports. Do not fabricate.

Classify "scope" (PRD §15.1):
- "one_off": this gap looks situational/momentary — do not generalize it into a stable rule.
- "context": a scene/role/relationship/language-specific pattern revealed here.
- "long_term": a stable trait — but ONE calibration rarely justifies long_term; prefer "context" unless
  the gap is unmistakable and broad. A single calibration must NOT rewrite the core self.`;

export function buildBlindComparatorMessages(input: {
  contextSummary: string;
  selfModelSubset: unknown;
  scenario: string;
  incomingMessage?: string | null;
  hiddenAgentAnswer: string;
  userAnswer: string;
}): LlmMessage[] {
  const modelBlock = JSON.stringify(input.selfModelSubset ?? {}, null, 2);
  const incoming = input.incomingMessage?.trim()
    ? `Incoming message:\n"""\n${input.incomingMessage.trim()}\n"""`
    : "No separate incoming message.";

  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        "Context:",
        input.contextSummary,
        "",
        "Current Self Model subset for this context:",
        "```json",
        modelBlock,
        "```",
        "",
        "Scenario:",
        '"""',
        input.scenario,
        '"""',
        incoming,
        "",
        "Hidden agent answer (the prediction):",
        '"""',
        input.hiddenAgentAnswer,
        '"""',
        "",
        "User's REAL answer:",
        '"""',
        input.userAnswer,
        '"""',
        "",
        "Return the difference report and ONE classified update_proposal as JSON.",
      ].join("\n"),
    },
  ];
}
