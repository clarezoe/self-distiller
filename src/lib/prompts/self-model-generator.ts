// Self Model generator prompt (PRD §9.5, §12, §15).
// Synthesizes user-accepted evidence into a Self Model (§12 JSON).

import type { LlmMessage } from "@/lib/llm/types";

export type EvidenceForGeneration = {
  id: string;
  claim: string;
  evidenceText: string;
  signalType: string;
  confidence: number;
  stability: string;
  language?: string | null;
  contextNames?: string[];
};

const SYSTEM = `You synthesize a user's accepted evidence into a structured Self Model.

The Self Model is multilingual, multi-role, multi-relationship, multi-scene (PRD §12). It captures
HOW the user expresses themselves and decides, not a generic persona.

Rules:
- Use ONLY the supplied evidence. Do not invent identity facts, values, or patterns with no support.
- Keys for language_models / role_models / relationship_models / scene_models are user-defined and
  composable. Use language codes when known (zh, en, sv) and natural keys for roles/relationships/scenes
  (e.g. "boss", "close_friend", "comforting"). Do not force a fixed set; only include what the evidence supports.
- Do NOT promote a single low-stability signal into a core_self rule. core_self entries need repeated,
  high-stability support. One-off moods go to current_state, not core_self.
- Prefer high-confidence, high-stability evidence for stable claims; keep weak signals out of core_self.
- Put genuinely uncertain or missing areas in "unknowns".
- Add 3-6 "suggested_interviews" that would most improve the model (each with a clear sampling goal).
- For language models, when there are non-native traces, capture current_level / common_mistakes /
  improvement_trend and a polish_policy; do not erase the user's authentic imperfections.
- Set a per-language "confidence" reflecting evidence strength.`;

export function buildSelfModelGeneratorMessages(input: {
  version: string;
  goal?: string;
  evidence: EvidenceForGeneration[];
}): LlmMessage[] {
  const evidenceBlock = input.evidence
    .map(
      (e, i) =>
        `#${i + 1} [id=${e.id}] (${e.signalType}, confidence=${e.confidence}, stability=${e.stability}${
          e.language ? `, lang=${e.language}` : ""
        }${e.contextNames?.length ? `, contexts=${e.contextNames.join("/")}` : ""})\n  claim: ${e.claim}\n  quote: ${e.evidenceText}`,
    )
    .join("\n\n");

  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Target Self Model version: ${input.version}${
        input.goal ? `\nProject goal: ${input.goal}` : ""
      }\n\nAccepted evidence (${input.evidence.length} items):\n\n${evidenceBlock}\n\nReturn the full Self Model as structured JSON matching the schema. Reference supporting evidence ids in role_models/relationship_models "evidence_ids" where applicable.`,
    },
  ];
}
