// Import Analyzer prompt (PRD §13.1, §14 spirit, §15 weighting/decay).
// Classifies a raw material and extracts traceable evidence items.

import type { JsonSchema, LlmMessage } from "@/lib/llm/types";

// Strict-mode compatible (OpenAI Structured Outputs): every property is listed in
// `required`, every object sets additionalProperties:false, and no unsupported
// keywords (e.g. minItems) are used. "At least 3" is enforced by the prompt + a
// runtime length check in analyzeMaterial, not by the schema.
export const EVIDENCE_EXTRACTION_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    classification: {
      type: "object",
      properties: {
        detected_language: { type: "string" },
        detected_source_type: { type: "string" },
        likely_ai_generated: { type: "boolean" },
        notes: { type: "string" },
      },
      required: ["detected_language", "detected_source_type", "likely_ai_generated", "notes"],
      additionalProperties: false,
    },
    evidence_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim: { type: "string" },
          evidence_text: { type: "string" },
          signal_type: {
            type: "string",
            enum: [
              "fact",
              "voice_pattern",
              "reaction_pattern",
              "decision_pattern",
              "relationship_pattern",
              "language_pattern",
              "boundary",
              "current_state",
            ],
          },
          confidence: { type: "number" },
          stability: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["claim", "evidence_text", "signal_type", "confidence", "stability"],
        additionalProperties: false,
      },
    },
  },
  required: ["classification", "evidence_items"],
  additionalProperties: false,
};

export type EvidenceExtractionResult = {
  classification: {
    detected_language: string;
    detected_source_type?: string;
    likely_ai_generated: boolean;
    notes?: string;
  };
  evidence_items: Array<{
    claim: string;
    evidence_text: string;
    signal_type:
      | "fact"
      | "voice_pattern"
      | "reaction_pattern"
      | "decision_pattern"
      | "relationship_pattern"
      | "language_pattern"
      | "boundary"
      | "current_state";
    confidence: number;
    stability: "low" | "medium" | "high";
  }>;
};

const SYSTEM = `You analyze a user's historical material to build a personal expression model.

Your job is NOT to summarize the content. Extract model-relevant signals about HOW the
user expresses themselves, decides, and interacts — not just what the topic is.

When the user message includes a current "Related context" / relationship hint, treat it as authoritative for this analysis. It overrides any relationship label embedded in the material text (including a chat header), because the material may have been re-labeled after import. Do not infer the current relationship from an older embedded label.

Rules (do not violate):
- Extract at least 3 evidence items.
- Every evidence item MUST quote the original text verbatim in "evidence_text". Never paraphrase the quote. Never invent text that is not present.
- "claim" is a concise model-relevant statement supported by that quote.
- Pick the most specific "signal_type": fact, voice_pattern, reaction_pattern, decision_pattern, relationship_pattern, language_pattern, boundary, current_state.
- Evidence weighting (set "confidence" 0-1 accordingly):
  - Private chat / things the user explicitly states / the user's own writing = high (0.7-0.95).
  - Public posts / copywriting / product text = medium (0.4-0.7) for tone.
  - Resume/bio = medium for facts, low for tone.
  - AI-generated text (if likely_ai_generated) = low (<=0.3) for tone/voice; do NOT treat it as the user's authentic style unless the user confirms.
- "stability": "high" only for long-term, repeated patterns; "low" for a one-time state (e.g. a momentary mood). A single irritated message is current_state with low stability, NOT a personality rule.
- Time decay: if the material is old, lower confidence for CURRENT expression style; long-term facts/history can stay.`;

// Pure: the contextHint for materials tagged with relationship contexts.
export function relationshipHint(names: string[]): string | undefined {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length === 0) return undefined;
  return `Relationship: ${clean.join(", ")}. Describe how the user (the "me:" lines) talks IN THIS RELATIONSHIP. Only "me:" lines are the user's style; other speakers are context.`;
}

const UNSET_CHAT_RELATIONSHIP_HINT =
  "Relationship not set. This is a structured Google Chat import: use only the user's \"me:\" lines as style evidence, and ignore any relationship label embedded in the material text or chat header.";

/**
 * Resolve the relationship instruction for a material. Structured Google Chat
 * imports must retain the owner-only boundary even when their relationship is
 * cleared; legacy plain-text materials have no reliable me:/speaker structure
 * and therefore retain the ordinary analyzer behavior.
 */
export function materialRelationshipHint(
  sourceMetadata: unknown,
  relationshipNames: string[],
): string | undefined {
  const source =
    sourceMetadata && typeof sourceMetadata === "object" && !Array.isArray(sourceMetadata)
      ? (sourceMetadata as { source?: unknown }).source
      : undefined;
  if (source !== "google_chat_takeout") return relationshipHint(relationshipNames);
  return relationshipHint(relationshipNames) ?? UNSET_CHAT_RELATIONSHIP_HINT;
}

export function buildImportAnalyzerMessages(input: {
  content: string;
  sourceType: string;
  language?: string | null;
  materialTime?: string | null;
  contextHint?: string;
}): LlmMessage[] {
  const meta = [
    `Declared source type: ${input.sourceType}`,
    input.language ? `Declared language: ${input.language}` : null,
    input.materialTime ? `Material time: ${input.materialTime}` : null,
    input.contextHint ? `Related context: ${input.contextHint}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `${meta}\n\nMaterial:\n\"\"\"\n${input.content}\n\"\"\"\n\nReturn the classification and evidence items as structured JSON.`,
    },
  ];
}
